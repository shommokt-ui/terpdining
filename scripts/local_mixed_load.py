"""Exercise reads, tracker writes, and a mocked scrape against a disposable local server.

Start uvicorn with DINING_DB_PATH pointing at an isolated SQLite copy, then run:
python scripts/local_mixed_load.py --url http://127.0.0.1:8765 --db /tmp/terpdining-load-isolated.db
Never point this script at production.
"""

import argparse
import asyncio
import json
import sqlite3
import sys
import time
import uuid
from collections import Counter
from datetime import date
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.load_test import percentile


def replay_scrape(db_path, day):
    from src.scraping import scraper

    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    rows = db.execute("""SELECT dh.location_num, me.meal, me.station, fi.name, fi.label_url
                         FROM menu_entries me JOIN dining_halls dh ON dh.id=me.hall_id
                         JOIN food_items fi ON fi.id=me.food_item_id WHERE me.date=?""", (day,)).fetchall()
    menus = {}
    for row in rows:
        meals = menus.setdefault(row["location_num"], {})
        stations = meals.setdefault(row["meal"], {})
        items = stations.setdefault(row["station"], [])
        items.append({"name": row["name"], "label_url": row["label_url"], "dietary_tags": []})
    db.close()

    def fake_menu(_session, location, _date):
        return {"meals": {meal: [{"station": station, "items": items}
                                 for station, items in stations.items()]
                          for meal, stations in menus[location].items()}}

    scraper.scrape_menu = fake_menu
    scraper.REQUEST_DELAY = 0
    scraper.scrape_to_db(start_date=date.fromisoformat(day), days=1,
                         include_nutrition=False, db_path=db_path)


async def main(args):
    if args.url not in ("http://127.0.0.1:8765", "http://localhost:8765"):
        raise SystemExit("Mixed test is restricted to local port 8765")
    db_path = Path(args.db).resolve()
    if not db_path.exists() or db_path.name == "umd_dining.db":
        raise SystemExit("Use an existing disposable DB, not the project database")
    async with httpx.AsyncClient(base_url=args.url, timeout=15) as client:
        menu = (await client.get("/api/menu/browse")).json()
        day = menu["date"] if menu["halls"] else menu["latest_date"]
        menu = (await client.get("/api/menu/browse", params={"dt": day})).json()
        food_ids = [item["food_item_id"] for meals in menu["halls"].values()
                    for stations in meals.values() for items in stations.values() for item in items]
        if not food_ids:
            raise SystemExit("No menu rows in isolated DB")
        email = f"load-{uuid.uuid4().hex}@example.com"
        auth = await client.post("/api/auth/register", json={"email": email, "password": "local-load-only"})
        auth.raise_for_status()
        headers = {"Authorization": "Bearer " + auth.json()["access_token"]}
        records = []

        async def call(method, route, **kwargs):
            start = time.perf_counter()
            try:
                response = await client.request(method, route, **kwargs)
                status = response.status_code
            except httpx.HTTPError:
                status = 0
            records.append({"route": route, "status": status,
                            "ms": (time.perf_counter() - start) * 1000})

        async def browser():
            for _ in range(10):
                await call("GET", "/api/menu/browse", params={"dt": day})
                await call("GET", "/api/nutrition/search", params={"q": "chicken"})

        async def writer():
            for _ in range(5):
                await call("POST", "/api/tracker/logs", headers=headers,
                           json={"food_item_id": food_ids[0], "servings": 1,
                                 "meal_type": "Lunch", "logged_date": day})

        start = time.perf_counter()
        await asyncio.gather(*(browser() for _ in range(10)),
                             *(writer() for _ in range(10)),
                             asyncio.to_thread(replay_scrape, str(db_path), day))
        elapsed = time.perf_counter() - start
        by_route = {}
        for route in sorted({r["route"] for r in records}):
            subset = [r for r in records if r["route"] == route]
            by_route[route] = {"requests": len(subset),
                               "p95_ms": round(percentile([r["ms"] for r in subset], 95), 1),
                               "statuses": dict(Counter(str(r["status"]) for r in subset))}
        result = {"date": day, "elapsed_seconds": round(elapsed, 2),
                  "requests": len(records), "rps": round(len(records) / elapsed, 2),
                  "by_route": by_route, "scrape": "completed without UMD network requests"}
        print(json.dumps(result, indent=2))
        Path(args.output).write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8765")
    parser.add_argument("--db", required=True)
    parser.add_argument("--output", default="/tmp/terpdining-local-mixed.json")
    asyncio.run(main(parser.parse_args()))
