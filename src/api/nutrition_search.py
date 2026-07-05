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
            SELECT fi.id AS food_item_id, fi.name,
                   fn.serving_size, fn.calories, fn.protein_g,
                   fn.total_fat_g, fn.total_carbs_g, fn.sodium_mg, fn.allergens
            FROM food_items fi
            LEFT JOIN food_nutrition fn ON fn.food_item_id = fi.id
            WHERE LOWER(fi.name) LIKE LOWER(?)
            ORDER BY LENGTH(fi.name), fi.name
            LIMIT 20
            """,
            (pattern,),
        ).fetchall()
        return {
            "results": [
                {
                    "food_item_id": r["food_item_id"],
                    "name": r["name"],
                    "serving_size": r["serving_size"] or "",
                    "calories": r["calories"],
                    "protein_g": r["protein_g"],
                    "total_fat_g": r["total_fat_g"],
                    "total_carbs_g": r["total_carbs_g"],
                    "sodium_mg": r["sodium_mg"],
                    "allergens": r["allergens"] or "",
                }
                for r in rows
            ]
        }
    finally:
        conn.close()
