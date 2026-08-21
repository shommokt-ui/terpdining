"""DB schema + init.

Two backends behind one interface:

- SQLite (default): local dev and tests, zero setup, same as always.
- Postgres: used when the ``DATABASE_URL`` env var is set (e.g. Neon on
  Render). Queries throughout the codebase are written in the dialect
  subset both engines accept; the ``?`` placeholders are translated to
  ``%s`` by the connection wrapper below.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()

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

_SQLITE_SCHEMA_SQL = """\
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

CREATE TABLE IF NOT EXISTS reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    hall_id      INTEGER REFERENCES dining_halls(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name  TEXT,
    rating       INTEGER NOT NULL,
    comment      TEXT,
    created_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_food
    ON reviews (food_item_id);

CREATE INDEX IF NOT EXISTS idx_reviews_food_hall
    ON reviews (food_item_id, hall_id);
"""

# Same schema in Postgres dialect: identity columns instead of
# AUTOINCREMENT, DOUBLE PRECISION instead of REAL (SQLite's REAL is 8-byte).
_POSTGRES_SCHEMA_SQL = """\
CREATE TABLE IF NOT EXISTS dining_halls (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_num TEXT   NOT NULL UNIQUE,
    name         TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS food_items (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name      TEXT   NOT NULL,
    label_url TEXT   UNIQUE
);

CREATE TABLE IF NOT EXISTS food_nutrition (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    food_item_id          BIGINT NOT NULL UNIQUE REFERENCES food_items(id),
    serving_size          TEXT,
    serving_per_container TEXT,
    calories              INTEGER,
    protein_g             DOUBLE PRECISION,
    total_fat_g           DOUBLE PRECISION,
    total_carbs_g         DOUBLE PRECISION,
    sodium_mg             DOUBLE PRECISION,
    ingredients           TEXT,
    allergens             TEXT,
    nutrients_json        TEXT,
    scraped_at            TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_entries (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hall_id      BIGINT NOT NULL REFERENCES dining_halls(id),
    date         TEXT   NOT NULL,
    meal         TEXT   NOT NULL,
    station      TEXT   NOT NULL,
    food_item_id BIGINT NOT NULL REFERENCES food_items(id),
    scraped_at   TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS food_item_tags (
    food_item_id BIGINT NOT NULL REFERENCES food_items(id),
    tag          TEXT   NOT NULL,
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
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug       TEXT   NOT NULL UNIQUE,
    title      TEXT   NOT NULL,
    url        TEXT   NOT NULL,
    content    TEXT   NOT NULL,
    scraped_at TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT   NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,
    display_name  TEXT,
    created_at    TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS food_logs (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    food_item_id  BIGINT NOT NULL REFERENCES food_items(id),
    servings      DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    portion_label TEXT,
    meal_type     TEXT   NOT NULL,
    logged_date   TEXT   NOT NULL,
    created_at    TEXT   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_date
    ON food_logs (user_id, logged_date);

CREATE TABLE IF NOT EXISTS recipe_sessions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id),
    title      TEXT   NOT NULL DEFAULT 'New Recipe',
    created_at TEXT   NOT NULL,
    updated_at TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_messages (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES recipe_sessions(id) ON DELETE CASCADE,
    role       TEXT   NOT NULL,
    content    TEXT   NOT NULL,
    created_at TEXT   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_sessions_user
    ON recipe_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recipe_messages_session
    ON recipe_messages (session_id, id);

CREATE TABLE IF NOT EXISTS user_favorite_foods (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name  TEXT   NOT NULL,
    created_at TEXT   NOT NULL,
    PRIMARY KEY (user_id, food_name)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user
    ON user_favorite_foods (user_id);

CREATE TABLE IF NOT EXISTS user_goals (
    user_id       BIGINT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    calories      INTEGER NOT NULL DEFAULT 0,
    protein_g     DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_fat_g   DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_carbs_g DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at    TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
    token      TEXT   NOT NULL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT   NOT NULL,
    used_at    TEXT,
    created_at TEXT   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user
    ON password_resets (user_id);

CREATE TABLE IF NOT EXISTS reviews (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    food_item_id BIGINT NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    hall_id      BIGINT REFERENCES dining_halls(id) ON DELETE CASCADE,
    user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    author_name  TEXT,
    rating       INTEGER NOT NULL,
    comment      TEXT,
    created_at   TEXT   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_food
    ON reviews (food_item_id);

CREATE INDEX IF NOT EXISTS idx_reviews_food_hall
    ON reviews (food_item_id, hall_id);
"""


class PostgresConnection:
    """Thin wrapper giving a psycopg connection the sqlite3.Connection
    surface the rest of the codebase uses: ``execute(sql, params)`` with
    ``?`` placeholders, dict-style rows, ``commit``/``close``, and
    ``executescript`` for schema DDL.
    """

    is_postgres = True

    def __init__(self, url: str):
        import psycopg
        from psycopg.rows import dict_row

        self._conn = psycopg.connect(url, row_factory=dict_row)

    def execute(self, sql: str, params=()):
        return self._conn.execute(sql.replace("?", "%s"), params)

    def executescript(self, sql: str):
        self._conn.execute(sql)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def is_postgres(conn) -> bool:
    return getattr(conn, "is_postgres", False)


def get_connection(db_path: Path | str | None = None):
    """Get a db connection.

    Postgres when DATABASE_URL is set and no explicit SQLite path was
    requested (tests pass tmp paths and must stay on SQLite); otherwise
    SQLite at ``db_path`` / the default file.
    """
    if DATABASE_URL and db_path is None:
        return PostgresConnection(DATABASE_URL)

    path = Path(db_path) if db_path else DEFAULT_DB_PATH
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn) -> None:
    """Run schema + seed halls."""
    _migrate_reviews_table(conn)
    schema = _POSTGRES_SCHEMA_SQL if is_postgres(conn) else _SQLITE_SCHEMA_SQL
    conn.executescript(schema)
    for loc_num, name in DINING_HALLS_SEED:
        conn.execute(
            "INSERT INTO dining_halls (location_num, name) VALUES (?, ?) "
            "ON CONFLICT (location_num) DO NOTHING",
            (loc_num, name),
        )
    conn.commit()
    if not is_postgres(conn):
        _ensure_portion_label_column(conn)


def _ensure_portion_label_column(conn) -> None:
    """Migration for SQLite DBs created before portion_label existed."""
    cols = [row[1] for row in conn.execute("PRAGMA table_info(food_logs)").fetchall()]
    if cols and "portion_label" not in cols:
        conn.execute("ALTER TABLE food_logs ADD COLUMN portion_label TEXT")
        conn.commit()


def _migrate_reviews_table(conn) -> None:
    """Migrate older reviews tables to the current shape.

    Reviews evolved twice: first from an account-bound, one-per-user table
    (no ``author_name``) to open/append-only, then to per-hall scoping (adding
    ``hall_id``). SQLite can't add these constraints in place, so we detect an
    outdated table by the missing ``hall_id`` column (which also implies the
    even older ``author_name``-less shape) and drop it so the schema recreates
    it fresh. Any existing review rows are discarded — acceptable while the
    feature is new.
    """
    if is_postgres(conn):
        exists = conn.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'reviews'"
        ).fetchone()
        if not exists:
            return
        has_col = conn.execute(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'reviews' AND column_name = 'hall_id'"
        ).fetchone()
        if not has_col:
            conn.execute("DROP TABLE reviews")
            conn.commit()
        return

    table = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reviews'"
    ).fetchone()
    if not table:
        return
    cols = [row[1] for row in conn.execute("PRAGMA table_info(reviews)").fetchall()]
    if "hall_id" not in cols:
        conn.execute("DROP TABLE reviews")
        conn.commit()
