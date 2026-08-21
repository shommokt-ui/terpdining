"""Dish reviews: auth gating, upsert, validation, public read, and summary."""

from __future__ import annotations

from conftest import seed_food


def test_write_and_delete_require_auth(client, db):
    food_id = seed_food(db)
    assert client.post("/api/reviews", json={"food_item_id": food_id, "rating": 5}).status_code in (401, 403)
    assert client.delete(f"/api/reviews/{food_id}").status_code in (401, 403)


def test_public_can_read_empty(client, db):
    food_id = seed_food(db)
    resp = client.get(f"/api/reviews/{food_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 0
    assert body["average"] is None
    assert body["reviews"] == []
    assert body["my_review"] is None


def test_create_list_roundtrip(client, db, auth_headers):
    food_id = seed_food(db)
    resp = client.post(
        "/api/reviews",
        json={"food_item_id": food_id, "rating": 4, "comment": "  Solid  "},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    out = resp.json()
    assert out["rating"] == 4
    assert out["comment"] == "Solid"
    assert out["is_mine"] is True

    listed = client.get(f"/api/reviews/{food_id}", headers=auth_headers).json()
    assert listed["count"] == 1
    assert listed["average"] == 4.0
    assert listed["my_review"]["rating"] == 4
    assert listed["reviews"][0]["is_mine"] is True


def test_upsert_is_one_per_user(client, db, auth_headers):
    food_id = seed_food(db)
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 2}, headers=auth_headers)
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 5, "comment": "changed"}, headers=auth_headers)

    listed = client.get(f"/api/reviews/{food_id}").json()
    assert listed["count"] == 1
    assert listed["average"] == 5.0
    assert listed["reviews"][0]["comment"] == "changed"


def test_rating_out_of_range_rejected(client, db, auth_headers):
    food_id = seed_food(db)
    assert client.post("/api/reviews", json={"food_item_id": food_id, "rating": 0}, headers=auth_headers).status_code == 422
    assert client.post("/api/reviews", json={"food_item_id": food_id, "rating": 6}, headers=auth_headers).status_code == 422


def test_unknown_dish_rejected(client, db, auth_headers):
    assert client.post("/api/reviews", json={"food_item_id": 999999, "rating": 3}, headers=auth_headers).status_code == 404


def test_delete_removes_only_own(client, db, auth_headers):
    food_id = seed_food(db)
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 3}, headers=auth_headers)
    assert client.delete(f"/api/reviews/{food_id}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/reviews/{food_id}").json()["count"] == 0


def test_summary_batches_averages(client, db, auth_headers):
    a = seed_food(db, name="Pizza")
    b = seed_food(db, name="Salad")
    client.post("/api/reviews", json={"food_item_id": a, "rating": 4}, headers=auth_headers)
    client.post("/api/reviews", json={"food_item_id": b, "rating": 2}, headers=auth_headers)

    summary = client.get(f"/api/reviews/summary?ids={a},{b},999999").json()
    assert summary[str(a)] == {"average": 4.0, "count": 1}
    assert summary[str(b)] == {"average": 2.0, "count": 1}
    assert str(999999) not in summary


def test_average_across_multiple_users(client, db, auth_headers):
    food_id = seed_food(db)
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 5}, headers=auth_headers)

    other = client.post(
        "/api/auth/register",
        json={"email": "terp2@example.com", "password": "password123"},
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    client.post("/api/reviews", json={"food_item_id": food_id, "rating": 2}, headers=other_headers)

    listed = client.get(f"/api/reviews/{food_id}").json()
    assert listed["count"] == 2
    assert listed["average"] == 3.5
