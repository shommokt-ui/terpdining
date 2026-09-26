"""UMD Dining Hall Menu & Nutrition Scraper.

Handles HTTP requests, retry logic, and orchestrates a full week scrape.
HTML parsing is delegated to parser.py.  Can write directly to SQLite
(incremental mode) or to JSON files (legacy / debug mode).
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from src.db.loader import _upsert_food_item, _upsert_nutrition, _upsert_tags
from src.db.models import get_connection, init_db, is_postgres
from src.scraping.parser import parse_menu_page, parse_nutrition_label

BASE_URL = "https://nutrition.umd.edu/"

DINING_HALLS: dict[str, str] = {
    "16": "South Campus",
    "19": "Yahentamitsi Dining Hall",
    "51": "251 North",
}

DATA_DIR = Path("data")

REQUEST_DELAY = 0.3
MAX_RETRIES = 3
RETRY_BACKOFF = 2

NUTRITION_FRESHNESS_DAYS = 7

log = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------
# HTTP helpers
# ------------------------------------------------------------------

def create_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "UMD-Dining-Scraper/1.0 (student project)",
    })
    return s


def fetch_soup(session: requests.Session, url: str, params: dict | None = None) -> BeautifulSoup:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except (requests.ConnectionError, requests.Timeout) as exc:
            if attempt == MAX_RETRIES:
                raise
            wait = RETRY_BACKOFF * (2 ** (attempt - 1))
            log.warning("Request failed (attempt %d/%d), retrying in %ds: %s", attempt, MAX_RETRIES, wait, exc)
            time.sleep(wait)


# ------------------------------------------------------------------
# Scrape functions
# ------------------------------------------------------------------

def scrape_menu(session: requests.Session, location_num: str, dt: date) -> dict[str, Any]:
    """Scrape the full menu for one dining hall on one date."""
    date_str = f"{dt.month}/{dt.day}/{dt.year}"
    soup = fetch_soup(session, BASE_URL, params={"locationNum": location_num, "dtdate": date_str})
    hall_name = DINING_HALLS.get(location_num, location_num)
    menu = parse_menu_page(soup, hall_name, location_num, dt.isoformat())
    if not menu['meals']:
        # An error/challenge page must never erase a previously saved menu.
        raise ValueError(f"No menu tabs found for {hall_name} on {dt}")
    return menu


def scrape_nutrition_label_http(session: requests.Session, url: str) -> dict[str, Any]:
    """Fetch and parse a single nutrition label page."""
    soup = fetch_soup(session, url)
    return parse_nutrition_label(soup, url)


# ------------------------------------------------------------------
# Incremental DB helpers
# ------------------------------------------------------------------

def _nutrition_is_fresh(conn: sqlite3.Connection, label_url: str) -> bool:
    """Return True if we already have nutrition scraped within the freshness window."""
    row = conn.execute(
        """\
        SELECT fn.scraped_at FROM food_nutrition fn
        JOIN food_items fi ON fi.id = fn.food_item_id
        WHERE fi.label_url = ?
        """,
        (label_url,),
    ).fetchone()
    if not row:
        return False
    try:
        scraped = datetime.fromisoformat(row["scraped_at"])
        cutoff = datetime.now(timezone.utc) - timedelta(days=NUTRITION_FRESHNESS_DAYS)
        return scraped > cutoff
    except (ValueError, TypeError):
        return False


def _get_hall_id(conn: sqlite3.Connection, location_num: str) -> int:
    row = conn.execute("SELECT id FROM dining_halls WHERE location_num = ?", (location_num,)).fetchone()
    return row["id"]


# ------------------------------------------------------------------
# Scrape-to-DB pipeline
# ------------------------------------------------------------------

def scrape_to_db(
    start_date: date | None = None,
    days: int = 7,
    include_nutrition: bool = True,
    db_path: str | Path | None = None,
) -> dict[str, int]:
    """Save menus first, then refresh nutrition, using the configured database.

    Each hall/date commits independently. One failed hall cannot roll back other
    halls, and slow nutrition pages cannot delay menus appearing in the app.
    """
    if start_date is None:
        start_date = datetime.now(ZoneInfo("America/New_York")).date()

    conn = get_connection(db_path)
    session = create_session()
    results: dict[str, int] = {}
    nutrition_items: dict[str, int] = {}
    failures: list[str] = []
    now = _now_iso()
    try:
        init_db(conn)
        for day_offset in range(days):
            dt = start_date + timedelta(days=day_offset)
            for loc_num, hall_name in DINING_HALLS.items():
                key = f"{dt.isoformat()}_{hall_name}"
                try:
                    log.info("Scraping %s on %s ...", hall_name, dt.isoformat())
                    menu = scrape_menu(session, loc_num, dt)
                    if is_postgres(conn):
                        # Serialize menu replacement across the API and external
                        # runner. Transaction locks also work with Neon pooling
                        # and release automatically on commit or rollback.
                        conn.execute("SELECT pg_advisory_xact_lock(847291603)")
                    hall_id = _get_hall_id(conn, loc_num)
                    conn.execute("DELETE FROM menu_entries WHERE hall_id = ? AND date = ?", (hall_id, dt.isoformat()))
                    entries_count = 0
                    hall_nutrition = {}
                    for meal_name, stations in menu["meals"].items():
                        for station in stations:
                            for item in station["items"]:
                                label_url = item.get("label_url")
                                food_item_id = _upsert_food_item(conn, item["name"], label_url)
                                _upsert_tags(conn, food_item_id, item.get("dietary_tags", []))
                                conn.execute(
                                    """INSERT INTO menu_entries (hall_id, date, meal, station, food_item_id, scraped_at)
                                       VALUES (?, ?, ?, ?, ?, ?)
                                       ON CONFLICT (hall_id, date, meal, station, food_item_id) DO NOTHING""",
                                    (hall_id, dt.isoformat(), meal_name, station["station"], food_item_id, now),
                                )
                                if label_url:
                                    hall_nutrition[label_url] = food_item_id
                                entries_count += 1
                    conn.commit()
                    nutrition_items.update(hall_nutrition)
                    results[key] = entries_count
                    log.info("Saved %s: %d menu entries", key, entries_count)
                except Exception:
                    conn.rollback()
                    failures.append(key)
                    log.exception("Menu refresh failed for %s; keeping its previous menu", key)
                finally:
                    time.sleep(REQUEST_DELAY)

        log.info("Menu phase finished: %d entries saved before fetching nutrition", sum(results.values()))
        if include_nutrition:
            for label_url, food_item_id in nutrition_items.items():
                requested_label = False
                try:
                    fresh = _nutrition_is_fresh(conn, label_url)
                    conn.commit()  # Do not hold a database transaction during HTTP.
                    if fresh:
                        continue
                    requested_label = True
                    nutrition = scrape_nutrition_label_http(session, label_url)
                    _upsert_nutrition(conn, food_item_id, nutrition)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    failures.append(f"nutrition:{food_item_id}")
                    log.exception("Nutrition refresh failed for food %s; keeping its saved nutrition", food_item_id)
                finally:
                    if requested_label:
                        time.sleep(REQUEST_DELAY)

        # A scheduled runner must exit unsuccessfully on partial failure so it
        # appears as a failed run, while already committed menus stay available.
        if failures:
            raise RuntimeError(f"Refresh incomplete: {len(failures)} failed updates ({', '.join(failures[:5])})")
        return results
    finally:
        session.close()
        conn.close()


# ------------------------------------------------------------------
# Legacy JSON-only driver (kept for debugging)
# ------------------------------------------------------------------

def scrape_week_json(
    start_date: date | None = None,
    days: int = 7,
    include_nutrition: bool = True,
) -> list[Path]:
    """Scrape all dining halls and write JSON files (no database)."""
    if start_date is None:
        start_date = date.today()

    DATA_DIR.mkdir(exist_ok=True)
    session = create_session()
    nutrition_cache: dict[str, dict[str, Any]] = {}
    written: list[Path] = []

    for day_offset in range(days):
        dt = start_date + timedelta(days=day_offset)
        for loc_num, hall_name in DINING_HALLS.items():
            slug = hall_name.lower().replace(" ", "_")
            out_path = DATA_DIR / f"{dt.isoformat()}_{slug}.json"

            log.info("Scraping %s on %s ...", hall_name, dt.isoformat())
            menu = scrape_menu(session, loc_num, dt)

            if include_nutrition:
                urls = {
                    item["label_url"]: item["name"]
                    for stations in menu["meals"].values()
                    for station in stations
                    for item in station["items"]
                    if item.get("label_url")
                }
                total = len(urls)
                log.info("Fetching nutrition labels for %d unique items...", total)
                for idx, (url, name) in enumerate(urls.items(), 1):
                    if url not in nutrition_cache:
                        try:
                            nutrition_cache[url] = scrape_nutrition_label_http(session, url)
                            log.info("  [%d/%d] %s", idx, total, name)
                        except Exception:
                            log.warning("  [%d/%d] FAILED: %s", idx, total, name, exc_info=True)
                            nutrition_cache[url] = {}
                        time.sleep(REQUEST_DELAY)

                for stations in menu["meals"].values():
                    for station in stations:
                        for item in station["items"]:
                            u = item.get("label_url")
                            if u and u in nutrition_cache:
                                item["nutrition"] = nutrition_cache[u]

            out_path.write_text(json.dumps(menu, indent=2, ensure_ascii=False))
            log.info("  → saved %s", out_path)
            written.append(out_path)

    log.info("Done. Wrote %d files. Nutrition cache has %d items.", len(written), len(nutrition_cache))
    return written
