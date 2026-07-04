#!/usr/bin/env python3
"""Load scraped JSON files into the SQLite database.

Usage:
    python run_loader.py                 # load all files from data/
    python run_loader.py --data-dir data --db umd_dining.db
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from src.db.loader import load_all_json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load scraped JSON into SQLite")
    parser.add_argument("--data-dir", type=str, default="data", help="Directory containing JSON files")
    parser.add_argument("--db", type=str, default="umd_dining.db", help="SQLite database path")
    args = parser.parse_args()

    results = load_all_json(Path(args.data_dir), db_path=args.db)

    total = sum(results.values())
    print(f"\nLoaded {len(results)} files, {total} total menu entries.")


if __name__ == "__main__":
    main()
