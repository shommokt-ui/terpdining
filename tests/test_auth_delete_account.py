from __future__ import annotations

import pytest

from src.api.auth import DeleteAccountRequest, delete_account
from src.db.models import get_connection, init_db


def test_delete_account_requires_current_password_and_cleans_user_data(tmp_path):
    db_path = tmp_path / "test.db"
    conn = get_connection(db_path)
    init_db(conn)

    from src.api.auth import _hash_password

    conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
        ("delete@example.com", _hash_password("correct-horse-battery-staple"), "2024-01-01T00:00:00+00:00"),
    )
    user_id = conn.execute(
        "SELECT id FROM users WHERE email = ?",
        ("delete@example.com",),
    ).fetchone()["id"]
    conn.execute(
        "INSERT INTO food_items (name, label_url) VALUES (?, ?)",
        ("Test Food", "https://example.com/food"),
    )
    food_item_id = conn.execute("SELECT id FROM food_items WHERE name = ?", ("Test Food",)).fetchone()["id"]
    conn.execute(
        "INSERT INTO food_logs (user_id, food_item_id, servings, meal_type, logged_date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, food_item_id, 1.0, "lunch", "2024-01-01", "2024-01-01T00:00:00+00:00"),
    )
    conn.execute(
        "INSERT INTO recipe_sessions (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (user_id, "Test Recipe", "2024-01-01T00:00:00+00:00", "2024-01-01T00:00:00+00:00"),
    )
    conn.commit()

    response = delete_account(
        body=DeleteAccountRequest(current_password="correct-horse-battery-staple"),
        user={"id": user_id, "email": "delete@example.com"},
        conn=conn,
    )

    assert response == {"ok": True}
    assert conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone() is None
    assert conn.execute("SELECT COUNT(*) FROM food_logs WHERE user_id = ?", (user_id,)).fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM recipe_sessions WHERE user_id = ?", (user_id,)).fetchone()[0] == 0


def test_delete_account_rejects_wrong_password(tmp_path):
    db_path = tmp_path / "test.db"
    conn = get_connection(db_path)
    init_db(conn)

    from src.api.auth import _hash_password

    conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
        ("wrong@example.com", _hash_password("password123"), "2024-01-01T00:00:00+00:00"),
    )
    user_id = conn.execute(
        "SELECT id FROM users WHERE email = ?",
        ("wrong@example.com",),
    ).fetchone()["id"]
    conn.commit()

    with pytest.raises(Exception):
        delete_account(
            body=DeleteAccountRequest(current_password="wrong-password"),
            user={"id": user_id, "email": "wrong@example.com"},
            conn=conn,
        )
