"""Dish reviews: fully public, append-only, optional name.

Also covers the anti-spam guard (per-IP rate limit + duplicate detection),
pagination, sorting, and the profanity filter.
"""

from __future__ import annotations

import pytest

from conftest import seed_food
from src.api import reviews


@pytest.fixture(autouse=True)
def _reset_spam():
    """Clear the module-level rate-limit state around every test."""
    reviews._reset_rate_limit()
    yield
    reviews._reset_rate_limit()


def test_post_requires_no_auth(client, db):
    food_id = seed_food(db)
    resp = client.post("/api/reviews", json={"food_item_id": food_id, "rating": 5})
    assert resp.status_code == 200, resp.text
    assert resp.json()["author"] == "Anonymous"


def test_public_can_read_empty(client, db):
    food_id = seed_food(db)
    resp = client.get(f"/api/reviews/{food_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 0
    assert body["average"] is None
    assert body["reviews"] == []
    assert body["has_more"] is False


def test_optional_name_used_as_author(client, db):
    food_id = seed_food(db)
    resp = client.post(
        "/api/reviews",
        json={"food_item_id": food_id, "rating": 4, "comment": "  Solid  ", "name": "  Testudo  "},
    )
    out = resp.json()
    assert out["author"] == "Testudo"
    assert out["comment"] == "Solid"


def test_blank_name_is_anonymous(client, db):
    food_id = seed_food(db)
    out = client.post("/api/reviews", json={"food_item_id": food_id, "rating": 3, "name": "   "}).json()
    assert out["author"] == "Anonymous"


def test_multiple_reviews_accumulate(client, db):
    food_id = seed_food(db)
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 5})
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 3})
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 4})

    listed = client.get(f"/api/reviews/{food_id}").json()
    assert listed["count"] == 3
    assert listed["average"] == 4.0
    assert listed["has_more"] is False


def test_logged_in_defaults_to_account_name(client, db, auth_headers):
    food_id = seed_food(db)
    out = client.post(
        "/api/reviews", json={"food_item_id": food_id, "rating": 5}, headers=auth_headers
    ).json()
    assert out["author"] == "terp"


def test_rating_out_of_range_rejected(client, db):
    food_id = seed_food(db)
    assert client.post("/api/reviews", json={"food_item_id": food_id, "rating": 0}).status_code == 422
    assert client.post("/api/reviews", json={"food_item_id": food_id, "rating": 6}).status_code == 422


def test_unknown_dish_rejected(client, db):
    assert client.post("/api/reviews", json={"food_item_id": 999999, "rating": 3}).status_code == 404


def test_summary_batches_averages(client, db):
    a = seed_food(db, name="Pizza")
    b = seed_food(db, name="Salad")
    client.post("/api/reviews", json={"food_item_id": a, "rating": 4})
    client.post("/api/reviews", json={"food_item_id": a, "rating": 2})
    client.post("/api/reviews", json={"food_item_id": b, "rating": 5})

    summary = client.get(f"/api/reviews/summary?ids={a},{b},999999").json()
    assert summary[str(a)] == {"average": 3.0, "count": 2}
    assert summary[str(b)] == {"average": 5.0, "count": 1}
    assert str(999999) not in summary


def test_pagination(client, db, monkeypatch):
    monkeypatch.setattr(reviews, "RATE_LIMIT_MAX", 1000)
    food_id = seed_food(db)
    for i in range(12):
        client.post("/api/reviews", json={"food_item_id": food_id, "rating": 3, "comment": f"c{i}"})

    first = client.get(f"/api/reviews/{food_id}?limit=10&offset=0").json()
    assert first["count"] == 12
    assert len(first["reviews"]) == 10
    assert first["has_more"] is True

    second = client.get(f"/api/reviews/{food_id}?limit=10&offset=10").json()
    assert len(second["reviews"]) == 2
    assert second["has_more"] is False


def test_sort_orders(client, db):
    food_id = seed_food(db)
    for rating, c in [(2, "a"), (5, "b"), (3, "c")]:
        client.post("/api/reviews", json={"food_item_id": food_id, "rating": rating, "comment": c})

    newest = client.get(f"/api/reviews/{food_id}?sort=newest").json()["reviews"]
    assert newest[0]["rating"] == 3  # last posted

    highest = client.get(f"/api/reviews/{food_id}?sort=highest").json()["reviews"]
    assert highest[0]["rating"] == 5

    lowest = client.get(f"/api/reviews/{food_id}?sort=lowest").json()["reviews"]
    assert lowest[0]["rating"] == 2


def test_rate_limit_blocks_bursts(client, db, monkeypatch):
    monkeypatch.setattr(reviews, "RATE_LIMIT_MAX", 3)
    food_id = seed_food(db)
    for i in range(3):
        assert client.post(
            "/api/reviews", json={"food_item_id": food_id, "rating": 4, "comment": f"c{i}"}
        ).status_code == 200
    blocked = client.post("/api/reviews", json={"food_item_id": food_id, "rating": 4, "comment": "c3"})
    assert blocked.status_code == 429


def test_duplicate_guard(client, db):
    food_id = seed_food(db)
    body = {"food_item_id": food_id, "rating": 5, "comment": "Amazing"}
    assert client.post("/api/reviews", json=body).status_code == 200
    dup = client.post("/api/reviews", json=body)
    assert dup.status_code == 429


def test_profanity_censored(client, db):
    food_id = seed_food(db)
    out = client.post(
        "/api/reviews",
        json={"food_item_id": food_id, "rating": 1, "comment": "this shit sucks", "name": "bitch"},
    ).json()
    assert "shit" not in out["comment"].lower()
    assert "*" in out["comment"]
    assert "bitch" not in out["author"].lower()
