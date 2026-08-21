"""Dish reviews: fully public, append-only, optional name."""

from __future__ import annotations

from conftest import seed_food


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


def test_logged_in_defaults_to_account_name(client, db, auth_headers):
    food_id = seed_food(db)
    out = client.post(
        "/api/reviews", json={"food_item_id": food_id, "rating": 5}, headers=auth_headers
    ).json()
    # auth_headers registers terp@example.com -> defaults to "terp"
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
