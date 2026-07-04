"""Load scraped JSON files into the SQLite database.

Reads data/*.json and upserts into the normalized schema defined in models.py.
"""

from __future__ import annotations

import json
import logging
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.db.models import get_connection, init_db

log = logging.getLogger(__name__)

_NUM_RE = re.compile(r"([\d,.]+)")


def _parse_float(text: str) -> float | None:
    """Extract the leading number from a string like '3.8g' -> 3.8."""
    if not text:
        return None
    m = _NUM_RE.search(text)
    if m:
        try:
            return float(m.group(1).replace(",", ""))
        except ValueError:
            return None
    return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------
# Upsert helpers
# ------------------------------------------------------------------

def _upsert_food_item(conn: sqlite3.Connection, name: str, label_url: str | None) -> int:
    """Insert or fetch existing food_item. Returns its id."""
    if label_url:
        row = conn.execute("SELECT id FROM food_items WHERE label_url = ?", (label_url,)).fetchone()
        if row:
            return row["id"]
    conn.execute(
        "INSERT OR IGNORE INTO food_items (name, label_url) VALUES (?, ?)",
        (name, label_url),
    )
    row = conn.execute("SELECT id FROM food_items WHERE label_url = ?", (label_url,)).fetchone()
    if row:
        return row["id"]
    row = conn.execute(
        "SELECT id FROM food_items WHERE name = ? AND label_url IS NULL", (name,)
    ).fetchone()
    return row["id"]


def _upsert_nutrition(conn: sqlite3.Connection, food_item_id: int, nutrition: dict[str, Any]) -> None:
    """Insert or replace nutrition data for a food item."""
    if not nutrition or not nutrition.get("name"):
        return

    nutrients = nutrition.get("nutrients", {})
    nutrients_json = json.dumps(nutrients, ensure_ascii=False)

    def _get_nutrient_val(key: str) -> float | None:
        entry = nutrients.get(key, {})
        return _parse_float(entry.get("amount", ""))

    calories = None
    cal_text = nutrition.get("calories", "")
    if cal_text:
        try:
            calories = int(float(cal_text))
        except (ValueError, TypeError):
            calories = None

    conn.execute(
        """\
        INSERT INTO food_nutrition
            (food_item_id, serving_size, serving_per_container, calories,
             protein_g, total_fat_g, total_carbs_g, sodium_mg,
             ingredients, allergens, nutrients_json, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(food_item_id) DO UPDATE SET
            serving_size          = excluded.serving_size,
            serving_per_container = excluded.serving_per_container,
            calories              = excluded.calories,
            protein_g             = excluded.protein_g,
            total_fat_g           = excluded.total_fat_g,
            total_carbs_g         = excluded.total_carbs_g,
            sodium_mg             = excluded.sodium_mg,
            ingredients           = excluded.ingredients,
            allergens             = excluded.allergens,
            nutrients_json        = excluded.nutrients_json,
            scraped_at            = excluded.scraped_at
        """,
        (
            food_item_id,
            nutrition.get("serving_size", ""),
            nutrition.get("serving_per_container", ""),
            calories,
            _get_nutrient_val("Protein"),
            _get_nutrient_val("Total Fat"),
            _get_nutrient_val("Total Carbohydrate"),
            _get_nutrient_val("Sodium"),
            nutrition.get("ingredients", ""),
            nutrition.get("allergens", ""),
            nutrients_json,
            _now_iso(),
        ),
    )


def _upsert_tags(conn: sqlite3.Connection, food_item_id: int, tags: list[str]) -> None:
    """Replace dietary/allergen tags for a food item."""
    conn.execute("DELETE FROM food_item_tags WHERE food_item_id = ?", (food_item_id,))
    for tag in tags:
        conn.execute(
            "INSERT OR IGNORE INTO food_item_tags (food_item_id, tag) VALUES (?, ?)",
            (food_item_id, tag),
        )


def _get_hall_id(conn: sqlite3.Connection, location_num: str) -> int:
    row = conn.execute("SELECT id FROM dining_halls WHERE location_num = ?", (location_num,)).fetchone()
    if not row:
        raise ValueError(f"Unknown location_num: {location_num}")
    return row["id"]


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------

def load_json_file(conn: sqlite3.Connection, path: Path) -> int:
    """Load a single scraped JSON file into the database.

    Returns the number of menu_entry rows inserted.
    """
    data = json.loads(path.read_text())
    location_num = data.get("location_num", "")
    dt = data.get("date", "")
    hall_id = _get_hall_id(conn, location_num)
    now = _now_iso()
    entries_count = 0

    # Clear existing menu entries for this hall+date to avoid duplicates
    conn.execute("DELETE FROM menu_entries WHERE hall_id = ? AND date = ?", (hall_id, dt))

    for meal_name, stations in data.get("meals", {}).items():
        for station in stations:
            station_name = station.get("station", "Unknown Station")
            for item in station.get("items", []):
                name = item.get("name", "")
                label_url = item.get("label_url")

                food_item_id = _upsert_food_item(conn, name, label_url)

                # Tags
                tags = item.get("dietary_tags", [])
                if tags:
                    _upsert_tags(conn, food_item_id, tags)

                # Nutrition
                nutrition = item.get("nutrition")
                if nutrition:
                    _upsert_nutrition(conn, food_item_id, nutrition)

                # Menu entry
                conn.execute(
                    """\
                    INSERT INTO menu_entries (hall_id, date, meal, station, food_item_id, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (hall_id, dt, meal_name, station_name, food_item_id, now),
                )
                entries_count += 1

    conn.commit()
    return entries_count


def load_all_json(data_dir: Path, db_path: Path | str | None = None) -> dict[str, int]:
    """Load every JSON file in ``data_dir`` into the database.

    Returns {filename: rows_inserted}.
    """
    conn = get_connection(db_path)
    init_db(conn)

    results: dict[str, int] = {}
    for jf in sorted(data_dir.glob("*.json")):
        log.info("Loading %s ...", jf.name)
        count = load_json_file(conn, jf)
        results[jf.name] = count
        log.info("  → %d menu entries", count)

    conn.close()
    return results
