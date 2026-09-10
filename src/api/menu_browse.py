"""Menu browse endpoint: returns today's menu organized by hall, meal, station."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from src.db.models import get_connection

router = APIRouter(prefix="/api/menu", tags=["menu"])


@router.get("/browse")
def browse_menu(dt: str = Query(default=None)):
    menu_date = dt or date.today().isoformat()
    conn = get_connection()
    try:
        rows = conn.execute(
            """\
            SELECT dh.name AS hall, me.meal, me.station,
                   fi.name AS item_name, fi.id AS food_item_id, fi.label_url
            FROM menu_entries me
            JOIN dining_halls dh ON dh.id = me.hall_id
            JOIN food_items fi   ON fi.id = me.food_item_id
            WHERE me.date = ?
            ORDER BY dh.name, me.meal, me.station, fi.name
            """,
            (menu_date,),
        ).fetchall()

        tag_cache: dict[int, list[str]] = {}
        for r in rows:
            fid = r["food_item_id"]
            if fid not in tag_cache:
                tags = conn.execute(
                    "SELECT tag FROM food_item_tags WHERE food_item_id = ?", (fid,)
                ).fetchall()
                tag_cache[fid] = [t["tag"] for t in tags]

        halls: dict = {}
        for r in rows:
            hall = r["hall"]
            meal = r["meal"]
            station = r["station"]
            if hall not in halls:
                halls[hall] = {}
            if meal not in halls[hall]:
                halls[hall][meal] = {}
            if station not in halls[hall][meal]:
                halls[hall][meal][station] = []
            halls[hall][meal][station].append({
                "name": r["item_name"],
                "food_item_id": r["food_item_id"],
                "label_url": r["label_url"] or "",
                "tags": tag_cache.get(r["food_item_id"], []),
            })

        latest_row = conn.execute("SELECT MAX(date) AS latest FROM menu_entries").fetchone()
        latest_date = latest_row["latest"] if latest_row else None

        all_halls = [
            r["name"]
            for r in conn.execute("SELECT name FROM dining_halls ORDER BY name").fetchall()
        ]

        return {
            "date": menu_date,
            "halls": halls,
            "latest_date": latest_date,
            "all_halls": all_halls,
        }
    finally:
        conn.close()
