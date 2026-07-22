"""Tracker: logging food, daily summary math, and goals upsert."""

from __future__ import annotations

from tests.conftest import seed_food


def test_tracker_requires_auth(client):
    assert client.get("/api/tracker/logs").status_code in (401, 403)
    assert client.get("/api/tracker/summary").status_code in (401, 403)
    assert client.get("/api/tracker/goals").status_code in (401, 403)


def test_log_food_and_read_back(client, db, auth_headers):
    food_id = seed_food(db, calories=250, protein=20.0, fat=10.0, carbs=15.0)

    resp = client.post(
        "/api/tracker/logs",
        json={"food_item_id": food_id, "servings": 2.0, "meal_type": "Lunch", "logged_date": "2026-07-21"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    logs = client.get("/api/tracker/logs?date=2026-07-21", headers=auth_headers).json()["logs"]
    assert len(logs) == 1
    log = logs[0]
    assert log["food_name"] == "Chicken Tikka Masala"
    # Nutrition scales by servings.
    assert log["calories"] == 500.0
    assert log["protein_g"] == 40.0


def test_log_unknown_food_404(client, auth_headers):
    resp = client.post(
        "/api/tracker/logs",
        json={"food_item_id": 999999, "servings": 1.0, "meal_type": "Lunch"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_summary_totals_across_meals(client, db, auth_headers):
    food_id = seed_food(db, calories=100, protein=10.0, fat=5.0, carbs=20.0)
    for meal, servings in [("Breakfast", 1.0), ("Lunch", 1.5)]:
        client.post(
            "/api/tracker/logs",
            json={"food_item_id": food_id, "servings": servings, "meal_type": meal, "logged_date": "2026-07-21"},
            headers=auth_headers,
        )

    summary = client.get("/api/tracker/summary?date=2026-07-21", headers=auth_headers).json()
    assert summary["totals"]["calories"] == 250.0
    assert summary["totals"]["protein_g"] == 25.0
    assert summary["meals"]["Breakfast"]["calories"] == 100.0
    assert summary["meals"]["Lunch"]["calories"] == 150.0


def test_delete_log(client, db, auth_headers):
    food_id = seed_food(db)
    log_id = client.post(
        "/api/tracker/logs",
        json={"food_item_id": food_id, "servings": 1.0, "meal_type": "Dinner", "logged_date": "2026-07-21"},
        headers=auth_headers,
    ).json()["id"]

    assert client.delete(f"/api/tracker/logs/{log_id}", headers=auth_headers).status_code == 204
    assert client.get("/api/tracker/logs?date=2026-07-21", headers=auth_headers).json()["logs"] == []
    # Deleting again is a 404, not a silent success.
    assert client.delete(f"/api/tracker/logs/{log_id}", headers=auth_headers).status_code == 404


def test_goals_default_to_zero_and_upsert(client, auth_headers):
    assert client.get("/api/tracker/goals", headers=auth_headers).json() == {
        "calories": 0, "protein_g": 0.0, "total_fat_g": 0.0, "total_carbs_g": 0.0,
    }

    resp = client.put(
        "/api/tracker/goals",
        json={"calories": 2200, "protein_g": 150, "total_fat_g": 70, "total_carbs_g": 250},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    goals = client.get("/api/tracker/goals", headers=auth_headers).json()
    assert goals["calories"] == 2200
    assert goals["protein_g"] == 150


def test_goals_clamp_negatives_to_zero(client, auth_headers):
    client.put(
        "/api/tracker/goals",
        json={"calories": -100, "protein_g": -5, "total_fat_g": 0, "total_carbs_g": 0},
        headers=auth_headers,
    )
    goals = client.get("/api/tracker/goals", headers=auth_headers).json()
    assert goals["calories"] == 0
    assert goals["protein_g"] == 0.0
