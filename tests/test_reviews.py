"""Dish reviews: fully public, append-only, optional name, scoped per hall.

Also covers the anti-spam guard (per-IP rate limit + duplicate detection),
pagination, sorting, and the profanity filter.
"""

from __future__ import annotations

import pytest

from conftest import seed_food
from src.api import reviews

# Seeded dining halls (see DINING_HALLS_SEED).
HALL_A = "South Campus"
HALL_B = "Yahentamitsi Dining Hall"


@pytest.fixture(autouse=True)
def _reset_spam():
    """Clear the module-level rate-limit state around every test."""
    reviews._reset_rate_limit()
    yield
    reviews._reset_rate_limit()


def _post(client, food_id, hall=HALL_A, rating=5, **extra):
    body = {"food_item_id": food_id, "hall": hall, "rating": rating, **extra}
    return client.post("/api/reviews", json=body)


def test_post_requires_no_auth(client, db):
    food_id = seed_food(db)
    resp = _post(client, food_id)
    assert resp.status_code == 200, resp.text
    assert resp.json()["author"] == "Anonymous"


def test_public_can_read_empty(client, db):
    food_id = seed_food(db)
    resp = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A})
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 0
    assert body["average"] is None
    assert body["reviews"] == []
    assert body["has_more"] is False


def test_optional_name_used_as_author(client, db):
    food_id = seed_food(db)
    resp = _post(client, food_id, rating=4, comment="  Solid  ", name="  Testudo  ")
    out = resp.json()
    assert out["author"] == "Testudo"
    assert out["comment"] == "Solid"


def test_blank_name_is_anonymous(client, db):
    food_id = seed_food(db)
    out = _post(client, food_id, rating=3, name="   ").json()
    assert out["author"] == "Anonymous"


def test_multiple_reviews_accumulate(client, db):
    food_id = seed_food(db)
    _post(client, food_id, rating=5)
    _post(client, food_id, rating=3)
    _post(client, food_id, rating=4)

    listed = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A}).json()
    assert listed["count"] == 3
    assert listed["average"] == 4.0
    assert listed["has_more"] is False


def test_reviews_scoped_per_hall(client, db):
    food_id = seed_food(db)
    _post(client, food_id, hall=HALL_A, rating=5, comment="south good")
    _post(client, food_id, hall=HALL_B, rating=1, comment="yahen bad")

    a = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A}).json()
    assert a["count"] == 1 and a["average"] == 5.0
    assert a["reviews"][0]["comment"] == "south good"

    b = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_B}).json()
    assert b["count"] == 1 and b["average"] == 1.0
    assert b["reviews"][0]["comment"] == "yahen bad"

    sa = client.get("/api/reviews/summary", params={"ids": str(food_id), "hall": HALL_A}).json()
    assert sa[str(food_id)] == {"average": 5.0, "count": 1}
    sb = client.get("/api/reviews/summary", params={"ids": str(food_id), "hall": HALL_B}).json()
    assert sb[str(food_id)] == {"average": 1.0, "count": 1}


def test_logged_in_defaults_to_account_name(client, db, auth_headers):
    food_id = seed_food(db)
    out = client.post(
        "/api/reviews",
        json={"food_item_id": food_id, "hall": HALL_A, "rating": 5},
        headers=auth_headers,
    ).json()
    assert out["author"] == "terp"


def test_rating_out_of_range_rejected(client, db):
    food_id = seed_food(db)
    assert _post(client, food_id, rating=0).status_code == 422
    assert _post(client, food_id, rating=6).status_code == 422


def test_unknown_dish_rejected(client, db):
    assert _post(client, 999999, rating=3).status_code == 404


def test_unknown_hall_rejected(client, db):
    food_id = seed_food(db)
    assert _post(client, food_id, hall="Nowhere Hall", rating=3).status_code == 400


def test_missing_hall_rejected(client, db):
    food_id = seed_food(db)
    assert client.post("/api/reviews", json={"food_item_id": food_id, "rating": 3}).status_code == 422


def test_summary_batches_averages(client, db):
    a = seed_food(db, name="Pizza")
    b = seed_food(db, name="Salad")
    _post(client, a, rating=4)
    _post(client, a, rating=2)
    _post(client, b, rating=5)

    summary = client.get(
        "/api/reviews/summary", params={"ids": f"{a},{b},999999", "hall": HALL_A}
    ).json()
    assert summary[str(a)] == {"average": 3.0, "count": 2}
    assert summary[str(b)] == {"average": 5.0, "count": 1}
    assert str(999999) not in summary


def test_pagination(client, db, monkeypatch):
    monkeypatch.setattr(reviews, "RATE_LIMIT_MAX", 1000)
    food_id = seed_food(db)
    for i in range(12):
        _post(client, food_id, rating=3, comment=f"c{i}")

    first = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A, "limit": 10, "offset": 0}).json()
    assert first["count"] == 12
    assert len(first["reviews"]) == 10
    assert first["has_more"] is True

    second = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A, "limit": 10, "offset": 10}).json()
    assert len(second["reviews"]) == 2
    assert second["has_more"] is False


def test_sort_orders(client, db):
    food_id = seed_food(db)
    for rating, c in [(2, "a"), (5, "b"), (3, "c")]:
        _post(client, food_id, rating=rating, comment=c)

    newest = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A, "sort": "newest"}).json()["reviews"]
    assert newest[0]["rating"] == 3  # last posted

    highest = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A, "sort": "highest"}).json()["reviews"]
    assert highest[0]["rating"] == 5

    lowest = client.get(f"/api/reviews/{food_id}", params={"hall": HALL_A, "sort": "lowest"}).json()["reviews"]
    assert lowest[0]["rating"] == 2


def test_rate_limit_blocks_bursts(client, db, monkeypatch):
    monkeypatch.setattr(reviews, "RATE_LIMIT_MAX", 3)
    food_id = seed_food(db)
    for i in range(3):
        assert _post(client, food_id, rating=4, comment=f"c{i}").status_code == 200
    assert _post(client, food_id, rating=4, comment="c3").status_code == 429


def test_duplicate_guard(client, db):
    food_id = seed_food(db)
    assert _post(client, food_id, rating=5, comment="Amazing").status_code == 200
    assert _post(client, food_id, rating=5, comment="Amazing").status_code == 429


def test_profanity_censored(client, db):
    food_id = seed_food(db)
    out = _post(client, food_id, rating=1, comment="this shit sucks", name="bitch").json()
    assert "shit" not in out["comment"].lower()
    assert "*" in out["comment"]
    assert "bitch" not in out["author"].lower()
