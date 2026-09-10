#!/usr/bin/env python3
"""Entry point for the UMD Dining scraper.

Target database: writes go to Postgres when DATABASE_URL is set (shell env
or .env) — this is how production is updated — and to the local SQLite file
(umd_dining.db, or DINING_DB_PATH) otherwise. See src/db/models.get_connection.

Usage:
    # Scrape the current week into the configured database
    python run_scraper.py

    # Same, but force local SQLite regardless of DATABASE_URL
    python run_scraper.py --db umd_dining.db

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
import sys
import threading
import time
from datetime import date, datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

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


def _fmt_elapsed(seconds: float) -> str:
    total = int(round(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


class _ElapsedTimer:
    """Ticks a running elapsed-seconds counter while the scraper works.

    On a TTY it rewrites one line in place every second; when output is
    redirected (log file, background task) it emits a line every
    ``log_every`` seconds so progress is still visible.
    """

    def __init__(self, log_every: int = 15) -> None:
        self._log_every = log_every
        self._started = time.monotonic()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._tty = sys.stderr.isatty()

    def __enter__(self) -> "_ElapsedTimer":
        self._thread.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self._stop.set()
        self._thread.join(timeout=2)
        if self._tty:
            sys.stderr.write("\r\033[K")
            sys.stderr.flush()

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self._started

    def _run(self) -> None:
        last_logged = 0
        while not self._stop.wait(1.0):
            secs = int(self.elapsed)
            if self._tty:
                sys.stderr.write(f"\r\033[K  scraper running — {secs}s elapsed")
                sys.stderr.flush()
            elif secs - last_logged >= self._log_every:
                log.info("still running — %s elapsed", _fmt_elapsed(secs))
                last_logged = secs


def _run_once(args: argparse.Namespace) -> None:
    start_date = date.fromisoformat(args.start) if args.start else None
    include_nutrition = not args.no_nutrition

    log.info("Scraper started at %s", datetime.now().isoformat(timespec="seconds"))
    with _ElapsedTimer() as timer:
        try:
            if args.json:
                scrape_week_json(start_date=start_date, days=args.days, include_nutrition=include_nutrition)
            else:
                scrape_to_db(start_date=start_date, days=args.days, include_nutrition=include_nutrition, db_path=args.db)
        finally:
            log.info("Scraper ran for %s", _fmt_elapsed(timer.elapsed))


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
