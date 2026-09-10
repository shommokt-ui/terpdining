"""Tracker routes — log food, get logs, daily summary."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from src.api.deps import get_current_user, get_db

router = APIRouter(prefix="/api/tracker", tags=["tracker"])


class LogFoodRequest(BaseModel):
    food_item_id: int
    servings: float = 1.0
    portion_label: str | None = None
    meal_type: str  # Breakfast, Lunch, Dinner, Snack
    logged_date: str | None = None  # YYYY-MM-DD, defaults to today


class FoodLogOut(BaseModel):
    id: int
    food_item_id: int
    food_name: str
    label_url: str | None
    servings: float
    portion_label: str | None
    meal_type: str
    logged_date: str
    calories: float | None
    protein_g: float | None
    total_fat_g: float | None
    total_carbs_g: float | None


class DailySummary(BaseModel):
    date: str
    meals: dict[str, dict]
    totals: dict


def _ensure_portion_label_column(conn):
    """Migration — add portion_label if missing (older SQLite DBs only)."""
    if getattr(conn, "is_postgres", False):
        return
    cols = [row[1] for row in conn.execute("PRAGMA table_info(food_logs)").fetchall()]
    if "portion_label" not in cols:
        conn.execute("ALTER TABLE food_logs ADD COLUMN portion_label TEXT")
        conn.commit()


def _ensure_user_goals_table(conn):
    """Migration — create user_goals if older DB is missing it."""
    conn.execute(
        """\
        CREATE TABLE IF NOT EXISTS user_goals (
            user_id       INTEGER NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            calories      INTEGER NOT NULL DEFAULT 0,
            protein_g     REAL    NOT NULL DEFAULT 0,
            total_fat_g   REAL    NOT NULL DEFAULT 0,
            total_carbs_g REAL    NOT NULL DEFAULT 0,
            updated_at    TEXT    NOT NULL
        )
        """
    )
    conn.commit()


EMPTY_GOALS = {"calories": 0, "protein_g": 0.0, "total_fat_g": 0.0, "total_carbs_g": 0.0}


@router.get("/goals")
def get_goals(user=Depends(get_current_user), conn=Depends(get_db)):
    """Return the current user's daily macro goals (zeros if unset)."""
    _ensure_user_goals_table(conn)
    row = conn.execute(
        "SELECT calories, protein_g, total_fat_g, total_carbs_g "
        "FROM user_goals WHERE user_id = ?",
        (user["id"],),
    ).fetchone()
    if not row:
        return dict(EMPTY_GOALS)
    return {
        "calories": row["calories"],
        "protein_g": row["protein_g"],
        "total_fat_g": row["total_fat_g"],
        "total_carbs_g": row["total_carbs_g"],
    }


class GoalsRequest(BaseModel):
    calories: int = 0
    protein_g: float = 0
    total_fat_g: float = 0
    total_carbs_g: float = 0


@router.put("/goals")
def set_goals(body: GoalsRequest, user=Depends(get_current_user), conn=Depends(get_db)):
    """Upsert the current user's daily macro goals."""
    _ensure_user_goals_table(conn)
    calories = max(0, body.calories)
    protein_g = max(0.0, body.protein_g)
    total_fat_g = max(0.0, body.total_fat_g)
    total_carbs_g = max(0.0, body.total_carbs_g)
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """\
        INSERT INTO user_goals (user_id, calories, protein_g, total_fat_g, total_carbs_g, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            calories      = excluded.calories,
            protein_g     = excluded.protein_g,
            total_fat_g   = excluded.total_fat_g,
            total_carbs_g = excluded.total_carbs_g,
            updated_at    = excluded.updated_at
        """,
        (user["id"], calories, protein_g, total_fat_g, total_carbs_g, now),
    )
    conn.commit()
    return {
        "calories": calories,
        "protein_g": protein_g,
        "total_fat_g": total_fat_g,
        "total_carbs_g": total_carbs_g,
    }


@router.post("/logs", status_code=status.HTTP_201_CREATED)
def log_food(body: LogFoodRequest, user=Depends(get_current_user), conn=Depends(get_db)):
    _ensure_portion_label_column(conn)

    food = conn.execute("SELECT id, name FROM food_items WHERE id = ?", (body.food_item_id,)).fetchone()
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")

    log_date = body.logged_date or date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(
        "INSERT INTO food_logs (user_id, food_item_id, servings, portion_label, meal_type, logged_date, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
        (user["id"], body.food_item_id, body.servings, body.portion_label, body.meal_type, log_date, now),
    ).fetchone()
    conn.commit()
    return {"id": row["id"], "food_name": food["name"]}


@router.get("/logs")
def get_logs(
    date: str = Query(default=None),
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    _ensure_portion_label_column(conn)

    log_date = date or __import__("datetime").date.today().isoformat()

    rows = conn.execute(
        """\
        SELECT fl.id, fl.food_item_id, fi.name AS food_name, fi.label_url,
               fl.servings, fl.portion_label, fl.meal_type, fl.logged_date,
               fn.calories, fn.protein_g, fn.total_fat_g, fn.total_carbs_g
        FROM food_logs fl
        JOIN food_items fi ON fi.id = fl.food_item_id
        LEFT JOIN food_nutrition fn ON fn.food_item_id = fi.id
        WHERE fl.user_id = ? AND fl.logged_date = ?
        ORDER BY fl.meal_type, fl.id
        """,
        (user["id"], log_date),
    ).fetchall()

    logs = []
    for r in rows:
        servings = r["servings"]
        logs.append({
            "id": r["id"],
            "food_item_id": r["food_item_id"],
            "food_name": r["food_name"],
            "label_url": r["label_url"] or None,
            "servings": servings,
            "portion_label": r["portion_label"],
            "meal_type": r["meal_type"],
            "logged_date": r["logged_date"],
            "calories": round(r["calories"] * servings, 1) if r["calories"] else None,
            "protein_g": round(r["protein_g"] * servings, 1) if r["protein_g"] else None,
            "total_fat_g": round(r["total_fat_g"] * servings, 1) if r["total_fat_g"] else None,
            "total_carbs_g": round(r["total_carbs_g"] * servings, 1) if r["total_carbs_g"] else None,
        })
    return {"logs": logs}


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(log_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    row = conn.execute(
        "SELECT id FROM food_logs WHERE id = ? AND user_id = ?", (log_id, user["id"])
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Log not found")
    conn.execute("DELETE FROM food_logs WHERE id = ?", (log_id,))
    conn.commit()


@router.get("/summary", response_model=DailySummary)
def daily_summary(
    date: str = Query(default=None),
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    log_date = date or __import__("datetime").date.today().isoformat()

    rows = conn.execute(
        """\
        SELECT fl.meal_type, fl.servings,
               fn.calories, fn.protein_g, fn.total_fat_g, fn.total_carbs_g
        FROM food_logs fl
        LEFT JOIN food_nutrition fn ON fn.food_item_id = fl.food_item_id
        WHERE fl.user_id = ? AND fl.logged_date = ?
        """,
        (user["id"], log_date),
    ).fetchall()

    meals: dict[str, dict] = {}
    totals = {"calories": 0, "protein_g": 0, "total_fat_g": 0, "total_carbs_g": 0}

    for r in rows:
        s = r["servings"]
        mt = r["meal_type"]
        if mt not in meals:
            meals[mt] = {"calories": 0, "protein_g": 0, "total_fat_g": 0, "total_carbs_g": 0}
        for key, col in [("calories", "calories"), ("protein_g", "protein_g"),
                         ("total_fat_g", "total_fat_g"), ("total_carbs_g", "total_carbs_g")]:
            val = (r[col] or 0) * s
            meals[mt][key] = round(meals[mt][key] + val, 1)
            totals[key] = round(totals[key] + val, 1)

    return DailySummary(date=log_date, meals=meals, totals=totals)
