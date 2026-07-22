"""Shared test setup: every test runs against a throwaway SQLite file.

The env vars must be set before anything imports ``src.db.models`` or
``server`` — module import is when the DB path and scheduler flag are read.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMPDIR = tempfile.mkdtemp(prefix="terpdining-tests-")
os.environ["DINING_DB_PATH"] = str(Path(_TMPDIR) / "test.db")
os.environ["ENABLE_SCRAPE_SCHEDULER"] = "false"
os.environ.pop("DATABASE_URL", None)

import pytest
from fastapi.testclient import TestClient

from src.db.models import get_connection, init_db

# Tables holding per-test state, deleted in FK-safe order before each test.
_MUTABLE_TABLES = [
    "food_logs",
    "user_favorite_foods",
    "user_goals",
    "recipe_messages",
    "recipe_sessions",
    "password_resets",
    "users",
    "menu_entries",
    "food_item_tags",
    "food_nutrition",
    "food_items",
]


@pytest.fixture()
def db():
    conn = get_connection()
    init_db(conn)
    for table in _MUTABLE_TABLES:
        conn.execute(f"DELETE FROM {table}")
    conn.commit()
    yield conn
    conn.close()


@pytest.fixture()
def client(db):
    from server import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_headers(client):
    """Register a user and return Authorization headers for them."""
    resp = client.post(
        "/api/auth/register",
        json={"email": "terp@example.com", "password": "password123"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def seed_food(conn, name="Chicken Tikka Masala", calories=250, protein=20.0, fat=10.0, carbs=15.0):
    """Insert a food item with nutrition, returning its id."""
    conn.execute(
        "INSERT INTO food_items (name, label_url) VALUES (?, ?)",
        (name, f"https://example.com/{name.replace(' ', '-')}"),
    )
    food_id = conn.execute("SELECT id FROM food_items WHERE name = ?", (name,)).fetchone()["id"]
    conn.execute(
        "INSERT INTO food_nutrition (food_item_id, calories, protein_g, total_fat_g, total_carbs_g, scraped_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (food_id, calories, protein, fat, carbs, "2026-01-01T00:00:00+00:00"),
    )
    conn.commit()
    return food_id
