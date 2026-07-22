"""Menu browse: public access, hall/meal/station grouping, and tags."""

from __future__ import annotations

from tests.conftest import seed_food


def _seed_menu_entry(conn, food_id, hall_name="South Campus", date="2026-07-21",
                     meal="Lunch", station="Chef's Table"):
    hall_id = conn.execute(
        "SELECT id FROM dining_halls WHERE name = ?", (hall_name,)
    ).fetchone()["id"]
    conn.execute(
        "INSERT INTO menu_entries (hall_id, date, meal, station, food_item_id, scraped_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (hall_id, date, meal, station, food_id, "2026-01-01T00:00:00+00:00"),
    )
    conn.commit()


def test_browse_is_public(client):
    resp = client.get("/api/menu/browse?dt=2026-07-21")
    assert resp.status_code == 200


def test_browse_groups_by_hall_meal_station(client, db):
    food_id = seed_food(db, name="Grilled Salmon")
    db.execute("INSERT INTO food_item_tags (food_item_id, tag) VALUES (?, ?)", (food_id, "HalalFriendly"))
    db.commit()
    _seed_menu_entry(db, food_id, hall_name="South Campus", meal="Lunch", station="Chef's Table")

    body = client.get("/api/menu/browse?dt=2026-07-21").json()
    assert body["date"] == "2026-07-21"
    items = body["halls"]["South Campus"]["Lunch"]["Chef's Table"]
    assert [i["name"] for i in items] == ["Grilled Salmon"]
    assert items[0]["tags"] == ["HalalFriendly"]
    assert body["latest_date"] == "2026-07-21"
    # All seeded halls are listed even when only one has menu data.
    assert set(body["all_halls"]) == {"South Campus", "Yahentamitsi Dining Hall", "251 North"}


def test_browse_empty_date_returns_no_halls(client, db):
    food_id = seed_food(db, name="Grilled Salmon")
    _seed_menu_entry(db, food_id, date="2026-07-21")

    body = client.get("/api/menu/browse?dt=2026-07-22").json()
    assert body["halls"] == {}
    # latest_date still reports the newest scraped menu so the UI can explain the gap.
    assert body["latest_date"] == "2026-07-21"
