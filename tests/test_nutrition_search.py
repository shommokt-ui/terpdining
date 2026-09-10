"""Nutrition search: matching, and the per-hall data the picker groups on."""

from __future__ import annotations

from tests.conftest import seed_food


def _seed_menu_entry(conn, food_id, hall_name="South Campus", date="2026-07-21",
                     meal="Breakfast", station="Grill"):
    hall_id = conn.execute(
        "SELECT id FROM dining_halls WHERE name = ?", (hall_name,)
    ).fetchone()["id"]
    conn.execute(
        "INSERT INTO menu_entries (hall_id, date, meal, station, food_item_id, scraped_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (hall_id, date, meal, station, food_id, "2026-01-01T00:00:00+00:00"),
    )
    conn.commit()


def _set_serving(conn, food_id, serving_size):
    conn.execute(
        "UPDATE food_nutrition SET serving_size = ? WHERE food_item_id = ?",
        (serving_size, food_id),
    )
    conn.commit()


def _seed_variant(conn, name, label_url, serving_size, calories):
    """A same-named food item with its own UMD recipe (distinct label_url)."""
    conn.execute(
        "INSERT INTO food_items (name, label_url) VALUES (?, ?)", (name, label_url)
    )
    fid = conn.execute(
        "SELECT id FROM food_items WHERE label_url = ?", (label_url,)
    ).fetchone()["id"]
    conn.execute(
        "INSERT INTO food_nutrition (food_item_id, serving_size, calories, protein_g, "
        "total_fat_g, total_carbs_g, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (fid, serving_size, calories, 20.0, 10.0, 15.0, "2026-01-01T00:00:00+00:00"),
    )
    conn.commit()
    return fid


def test_search_is_public_and_matches_substring(client, db):
    seed_food(db, name="Scrambled Eggs", calories=192)
    results = client.get("/api/nutrition/search?q=egg").json()["results"]
    assert [r["name"] for r in results] == ["Scrambled Eggs"]
    assert results[0]["calories"] == 192
    assert results[0]["label_url"]  # seed_food sets one


def test_search_reports_halls_and_last_served(client, db):
    fid = seed_food(db, name="Scrambled Eggs")
    _seed_menu_entry(db, fid, hall_name="South Campus", date="2026-07-20")
    _seed_menu_entry(db, fid, hall_name="251 North", date="2026-07-25")

    row = client.get("/api/nutrition/search?q=scrambled").json()["results"][0]
    assert set(row["halls"]) == {"South Campus", "251 North"}
    assert row["last_served"] == "2026-07-25"


def test_same_name_different_halls_come_back_as_separate_rows(client, db):
    """UMD gives the same dish different recipes per hall — the picker groups
    these client-side, so the API must return one row per food item with its
    own serving size and hall list."""
    south = _seed_variant(db, "Scrambled Eggs", "https://umd/label?r=12", "4 oz", 192)
    _seed_menu_entry(db, south, hall_name="South Campus", date="2026-07-21")

    north = _seed_variant(db, "Scrambled Eggs", "https://umd/label?r=211", "4 1/2 oz", 216)
    _seed_menu_entry(db, north, hall_name="251 North", date="2026-07-21")

    results = client.get("/api/nutrition/search?q=scrambled eggs").json()["results"]
    by_serving = {r["serving_size"]: r for r in results}
    assert set(by_serving) == {"4 oz", "4 1/2 oz"}
    assert by_serving["4 oz"]["halls"] == ["South Campus"]
    assert by_serving["4 1/2 oz"]["halls"] == ["251 North"]
    assert by_serving["4 oz"]["calories"] == 192
    assert by_serving["4 1/2 oz"]["calories"] == 216


def test_search_requires_query(client):
    assert client.get("/api/nutrition/search").status_code == 422
