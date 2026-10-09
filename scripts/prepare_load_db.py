"""Copy only public dining data into a disposable SQLite load-test database.

Example: DATABASE_URL= python scripts/prepare_load_db.py --source umd_dining.db --target /tmp/terpdining-load-isolated.db
No accounts, reviews, food logs, or recipe conversations are copied.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.db.models import get_connection, init_db


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    args = parser.parse_args()
    source, target = args.source.resolve(), args.target.resolve()
    if not source.is_file() or source == target:
        raise SystemExit("Source must exist and differ from target")
    if target.exists():
        raise SystemExit(f"Refusing to overwrite {target}")
    if os.getenv("DATABASE_URL"):
        raise SystemExit("Unset DATABASE_URL before preparing a local SQLite test")
    conn = get_connection(target)
    try:
        init_db(conn)
        conn.execute("ATTACH DATABASE ? AS source", (str(source),))
        for table in ("dining_halls", "food_items", "food_nutrition", "menu_entries", "food_item_tags"):
            conn.execute(f"DELETE FROM {table}")
            conn.execute(f"INSERT INTO {table} SELECT * FROM source.{table}")
        conn.commit()
        count = conn.execute("SELECT COUNT(*) FROM menu_entries").fetchone()[0]
        print(f"Prepared {target} with {count} menu entries and no private data")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
