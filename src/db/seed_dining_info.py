"""Seed the dining_info table with general UMD Dining pages."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from src.db.models import get_connection, init_db

log = logging.getLogger(__name__)

PAGES = [
    {
        "slug": "resident-plans",
        "title": "Resident Dining Plans",
        "url": "https://dining.umd.edu/students/resident-plans",
    },
    {
        "slug": "connector-plans",
        "title": "Connector & Block Meal Plans",
        "url": "https://dining.umd.edu/students/connector-plans",
    },
    {
        "slug": "dining-dollars",
        "title": "Dining Dollars",
        "url": "https://dining.umd.edu/students/dining-dollars-flexible-discounted-and-convenient",
    },
    {
        "slug": "nutrition-allergies-special-diets",
        "title": "Nutrition, Allergies & Special Diets",
        "url": "https://dining.umd.edu/students/nutrition-allergies-and-special-diets",
    },
    {
        "slug": "student-employment",
        "title": "Student Employment Opportunities",
        "url": "https://dining.umd.edu/students/student-employment-opportunities",
    },
    {
        "slug": "sick-meals",
        "title": "Sick Meals",
        "url": "https://dining.umd.edu/students/sick-meals",
    },
]


def _fetch_page_text(url: str) -> str:
    """Fetch a page and return its main text content."""
    resp = requests.get(url, timeout=30, headers={
        "User-Agent": "UMD-Dining-Scraper/1.0 (student project)",
    })
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.find("div", class_="main-content") or soup.body
    if not main:
        return soup.get_text("\n", strip=True)

    lines: list[str] = []
    for el in main.descendants:
        if el.name in ("h1", "h2", "h3", "h4"):
            lines.append(f"\n## {el.get_text(strip=True)}\n")
        elif el.name == "li":
            lines.append(f"- {el.get_text(strip=True)}")
        elif el.name == "p":
            text = el.get_text(strip=True)
            if text:
                lines.append(text)
        elif el.name == "tr":
            cells = [td.get_text(strip=True) for td in el.find_all(["th", "td"])]
            if cells:
                lines.append(" | ".join(cells))

    text = "\n".join(lines)
    # Collapse runs of blank lines
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.strip()


def seed_dining_info(db_path=None) -> int:
    """Scrape and upsert all general dining info pages. Returns count."""
    conn = get_connection(db_path)
    init_db(conn)
    now = datetime.now(timezone.utc).isoformat()
    count = 0

    for page in PAGES:
        log.info("Fetching %s ...", page["url"])
        try:
            content = _fetch_page_text(page["url"])
        except Exception:
            log.warning("Failed to fetch %s", page["url"], exc_info=True)
            continue

        conn.execute(
            """\
            INSERT INTO dining_info (slug, title, url, content, scraped_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                title      = excluded.title,
                url        = excluded.url,
                content    = excluded.content,
                scraped_at = excluded.scraped_at
            """,
            (page["slug"], page["title"], page["url"], content, now),
        )
        count += 1
        log.info("  → stored %s (%d chars)", page["slug"], len(content))

    conn.commit()
    conn.close()
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s")
    n = seed_dining_info()
    print(f"Seeded {n} dining info pages.")
