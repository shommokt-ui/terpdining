"""Nutrition search endpoint for the macro tracker food picker."""

from __future__ import annotations

from fastapi import APIRouter, Query

from src.db.models import get_connection

router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


@router.get("/search")
def search_nutrition(q: str = Query(..., min_length=1)):
    conn = get_connection()
    try:
        pattern = f"%{q}%"
        rows = conn.execute(
            """\
            SELECT fi.id AS food_item_id, fi.name, fi.label_url,
                   fn.serving_size, fn.calories, fn.protein_g,
                   fn.total_fat_g, fn.total_carbs_g, fn.sodium_mg, fn.allergens
            FROM food_items fi
            LEFT JOIN food_nutrition fn ON fn.food_item_id = fi.id
            WHERE LOWER(fi.name) LIKE LOWER(?)
            ORDER BY LENGTH(fi.name), fi.name
            LIMIT 60
            """,
            (pattern,),
        ).fetchall()

        # Which dining halls serve each match, and when it was last on a menu —
        # the food picker groups same-named items and lets the user pick the hall,
        # since UMD gives the same dish different recipes (portions) per hall.
        ids = [r["food_item_id"] for r in rows]
        halls_by_food: dict[int, list[str]] = {}
        last_served_by_food: dict[int, str] = {}
        if ids:
            placeholders = ",".join("?" for _ in ids)
            hall_rows = conn.execute(
                f"""\
                SELECT me.food_item_id AS fid, dh.name AS hall,
                       MAX(me.date) AS last_served
                FROM menu_entries me
                JOIN dining_halls dh ON dh.id = me.hall_id
                WHERE me.food_item_id IN ({placeholders})
                GROUP BY me.food_item_id, dh.name
                ORDER BY dh.name
                """,
                tuple(ids),
            ).fetchall()
            for hr in hall_rows:
                halls_by_food.setdefault(hr["fid"], []).append(hr["hall"])
                served = hr["last_served"] or ""
                if served > last_served_by_food.get(hr["fid"], ""):
                    last_served_by_food[hr["fid"]] = served

        return {
            "results": [
                {
                    "food_item_id": r["food_item_id"],
                    "name": r["name"],
                    "label_url": r["label_url"] or "",
                    "serving_size": r["serving_size"] or "",
                    "calories": r["calories"],
                    "protein_g": r["protein_g"],
                    "total_fat_g": r["total_fat_g"],
                    "total_carbs_g": r["total_carbs_g"],
                    "sodium_mg": r["sodium_mg"],
                    "allergens": r["allergens"] or "",
                    "halls": halls_by_food.get(r["food_item_id"], []),
                    "last_served": last_served_by_food.get(r["food_item_id"], ""),
                }
                for r in rows
            ]
        }
    finally:
        conn.close()
