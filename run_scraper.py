#!/usr/bin/env python3
"""Entry point for the UMD Dining scraper.

Usage:
    # Scrape the current week into SQLite (default)
    python run_scraper.py

    # Scrape menu only (skip per-item nutrition labels)
    python run_scraper.py --no-nutrition

    # Scrape a specific date range
    python run_scraper.py --start 2026-04-09 --days 3

    # Write JSON files instead of database
    python run_scraper.py --json

    # Run on a weekly loop (scrapes every Monday at midnight)
    python run_scraper.py --weekly
"""

from __future__ import annotations

import argparse
import logging
import time
from datetime import date, datetime, timedelta

from src.scraping.scraper import scrape_to_db, scrape_week_json

log = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)


def _next_monday() -> datetime:
    now = datetime.now()
    days_ahead = (7 - now.weekday()) % 7 or 7
    return now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=days_ahead)


def _run_once(args: argparse.Namespace) -> None:
    start_date = date.fromisoformat(args.start) if args.start else None
    include_nutrition = not args.no_nutrition

    if args.json:
        scrape_week_json(start_date=start_date, days=args.days, include_nutrition=include_nutrition)
    else:
        scrape_to_db(start_date=start_date, days=args.days, include_nutrition=include_nutrition, db_path=args.db)


def main() -> None:
    parser = argparse.ArgumentParser(description="UMD Dining Scraper")
    parser.add_argument("--start", type=str, default=None, help="Start date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument("--days", type=int, default=7, help="Number of days to scrape (default 7).")
    parser.add_argument("--no-nutrition", action="store_true", help="Skip per-item nutrition label scraping.")
    parser.add_argument("--json", action="store_true", help="Write JSON files instead of database.")
    parser.add_argument("--db", type=str, default=None, help="SQLite database path (default: DINING_DB_PATH env var, or ./umd_dining.db).")
    parser.add_argument("--weekly", action="store_true", help="Run in a loop, scraping every Monday.")
    args = parser.parse_args()

    if args.weekly:
        log.info("Weekly mode enabled — will scrape every Monday.")
        while True:
            _run_once(args)
            next_run = _next_monday()
            wait_secs = (next_run - datetime.now()).total_seconds()
            if wait_secs < 0:
                wait_secs = 0
            log.info("Next scrape at %s (sleeping %.0f seconds)", next_run.isoformat(), wait_secs)
            time.sleep(wait_secs)
    else:
        _run_once(args)


if __name__ == "__main__":
    main()
