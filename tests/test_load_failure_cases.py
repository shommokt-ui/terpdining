"""Isolated failure and concurrency probes. Never targets production."""

import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from fastapi.testclient import TestClient

from tests.conftest import seed_food
from tests.test_menu_browse import _seed_menu_entry


def test_database_outage_is_visible_as_api_error(client, monkeypatch):
    from server import app
    from src.api import menu_browse

    def unavailable(*_args, **_kwargs):
        raise sqlite3.OperationalError("simulated database outage")

    monkeypatch.setattr(menu_browse, "get_connection", unavailable)
    with TestClient(app, raise_server_exceptions=False) as probe:
        assert probe.get("/api/menu/browse").status_code == 500
        # Health is liveness only: it does not reveal a lost DB connection.
        assert probe.get("/api/health").status_code == 200


def test_concurrent_tracker_writes(client, db, auth_headers):
    food_id = seed_food(db)

    def write(_):
        return client.post("/api/tracker/logs", headers=auth_headers,
                           json={"food_item_id": food_id, "servings": 1,
                                 "meal_type": "Lunch", "logged_date": "2026-10-09"}).status_code

    with ThreadPoolExecutor(max_workers=20) as pool:
        statuses = list(pool.map(write, range(40)))
    assert statuses == [201] * 40
    assert len(client.get("/api/tracker/logs?date=2026-10-09", headers=auth_headers).json()["logs"]) == 40


def test_scrape_during_reads_and_failed_hall_preserves_previous_menu(client, db, monkeypatch):
    from src.scraping import scraper

    food = seed_food(db, name="Saved dish")
    _seed_menu_entry(db, food, date="2026-10-09")
    monkeypatch.setattr(scraper.time, "sleep", lambda _: None)

    def scrape_menu(_session, location, _date):
        if location == "16":
            raise TimeoutError("simulated hall outage")
        time.sleep(.02)
        return {"meals": {"Lunch": [{"station": "Test", "items": [
            {"name": "New dish", "label_url": "https://example.com/new", "dietary_tags": []}
        ]}]}}

    monkeypatch.setattr(scraper, "scrape_menu", scrape_menu)

    def refresh():
        try:
            scraper.scrape_to_db(start_date=date(2026, 10, 9), days=1, include_nutrition=False)
        except RuntimeError:
            return "partial failure"
        return "unexpected success"

    with ThreadPoolExecutor(max_workers=10) as pool:
        future = pool.submit(refresh)
        responses = list(pool.map(lambda _: client.get("/api/menu/browse?dt=2026-10-09"), range(30)))
        assert future.result() == "partial failure"
    assert all(response.status_code == 200 for response in responses)
    assert db.execute("SELECT id FROM menu_entries WHERE food_item_id = ?", (food,)).fetchone()


def test_slow_failing_ai_provider_returns_error_after_delay(db, auth_headers, monkeypatch):
    from server import app
    from src.api import recipe

    food = seed_food(db)
    _seed_menu_entry(db, food, date="2026-10-09")

    class FailingProvider:
        def invoke(self, _messages):
            time.sleep(.1)
            raise TimeoutError("simulated provider timeout")

    monkeypatch.setattr(recipe, "_get_llm", lambda: FailingProvider())
    with TestClient(app, raise_server_exceptions=False) as probe:
        start = time.perf_counter()
        response = probe.post("/api/recipe", headers=auth_headers,
                              json={"hall": "South Campus",
                                    "meal": "Lunch", "dt": "2026-10-09"})
        assert response.status_code == 502
        assert time.perf_counter() - start >= .1
        assert db.execute("SELECT COUNT(*) AS n FROM recipe_sessions").fetchone()["n"] == 0
