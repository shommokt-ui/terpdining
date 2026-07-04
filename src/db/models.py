"""DB schema + init."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

_env_db_path = (os.getenv("DINING_DB_PATH") or "").strip()
DEFAULT_DB_PATH = (
    Path(_env_db_path)
    if _env_db_path
    else Path(__file__).resolve().parent.parent.parent / "umd_dining.db"
)

DINING_HALLS_SEED = [
    ("16", "South Campus"),
    ("19", "Yahentamitsi Dining Hall"),
    ("51", "251 North"),
]

_SCHEMA_SQL = """\
CREATE TABLE IF NOT EXISTS dining_halls (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    location_num TEXT    NOT NULL UNIQUE,
    name         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS food_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    label_url TEXT    UNIQUE
);

CREATE TABLE IF NOT EXISTS food_nutrition (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    food_item_id          INTEGER NOT NULL UNIQUE REFERENCES food_items(id),
    serving_size          TEXT,
    serving_per_container TEXT,
    calories              INTEGER,
    protein_g             REAL,
    total_fat_g           REAL,
    total_carbs_g         REAL,
    sodium_mg             REAL,
    ingredients           TEXT,
    allergens             TEXT,
    nutrients_json        TEXT,
    scraped_at            TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_entries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    hall_id      INTEGER NOT NULL REFERENCES dining_halls(id),
    date         TEXT    NOT NULL,
    meal         TEXT    NOT NULL,
    station      TEXT    NOT NULL,
    food_item_id INTEGER NOT NULL REFERENCES food_items(id),
    scraped_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS food_item_tags (
    food_item_id INTEGER NOT NULL REFERENCES food_items(id),
    tag          TEXT    NOT NULL,
    PRIMARY KEY (food_item_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_menu_hall_date_meal
    ON menu_entries (hall_id, date, meal);

CREATE INDEX IF NOT EXISTS idx_menu_food_item
    ON menu_entries (food_item_id);

CREATE INDEX IF NOT EXISTS idx_food_nutrition_item
    ON food_nutrition (food_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_unique
    ON menu_entries (hall_id, date, meal, station, food_item_id);

CREATE TABLE IF NOT EXISTS dining_info (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT    NOT NULL UNIQUE,
    title      TEXT    NOT NULL,
    url        TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    scraped_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    display_name  TEXT,
    created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS food_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    food_item_id  INTEGER NOT NULL REFERENCES food_items(id),
    servings      REAL    NOT NULL DEFAULT 1.0,
    portion_label TEXT,
    meal_type     TEXT    NOT NULL,
    logged_date   TEXT    NOT NULL,
    created_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_date
    ON food_logs (user_id, logged_date);

CREATE TABLE IF NOT EXISTS recipe_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    title      TEXT    NOT NULL DEFAULT 'New Recipe',
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES recipe_sessions(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_sessions_user
    ON recipe_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recipe_messages_session
    ON recipe_messages (session_id, id);

CREATE TABLE IF NOT EXISTS user_favorite_foods (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name  TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    PRIMARY KEY (user_id, food_name)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user
    ON user_favorite_foods (user_id);

CREATE TABLE IF NOT EXISTS user_goals (
    user_id       INTEGER NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    calories      INTEGER NOT NULL DEFAULT 0,
    protein_g     REAL    NOT NULL DEFAULT 0,
    total_fat_g   REAL    NOT NULL DEFAULT 0,
    total_carbs_g REAL    NOT NULL DEFAULT 0,
    updated_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
    token      TEXT    NOT NULL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT    NOT NULL,
    used_at    TEXT,
    created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user
    ON password_resets (user_id);
"""


def get_connection(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Get a db connection, creating tables if needed."""
    path = Path(db_path) if db_path else DEFAULT_DB_PATH
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Run schema + seed halls."""
    conn.executescript(_SCHEMA_SQL)
    for loc_num, name in DINING_HALLS_SEED:
        conn.execute(
            "INSERT OR IGNORE INTO dining_halls (location_num, name) VALUES (?, ?)",
            (loc_num, name),
        )
    conn.commit()
    _ensure_user_favorites_table(conn)
    _ensure_user_goals_table(conn)


def _ensure_user_favorites_table(conn: sqlite3.Connection) -> None:
    """Migration for DBs created before user_favorite_foods existed."""
    conn.execute(
        """\
CREATE TABLE IF NOT EXISTS user_favorite_foods (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name  TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    PRIMARY KEY (user_id, food_name)
)"""
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorite_foods (user_id)"
    )
    conn.commit()


def _ensure_user_goals_table(conn: sqlite3.Connection) -> None:
    """Migration for DBs created before user_goals existed."""
    conn.execute(
        """\
CREATE TABLE IF NOT EXISTS user_goals (
    user_id       INTEGER NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    calories      INTEGER NOT NULL DEFAULT 0,
    protein_g     REAL    NOT NULL DEFAULT 0,
    total_fat_g   REAL    NOT NULL DEFAULT 0,
    total_carbs_g REAL    NOT NULL DEFAULT 0,
    updated_at    TEXT    NOT NULL
)"""
    )
    conn.commit()
