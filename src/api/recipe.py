"""Recipe Creator endpoint: generates recipes from available dining hall ingredients."""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from src.api.deps import get_current_user, get_db
from src.db.models import get_connection

router = APIRouter(prefix="/api", tags=["recipe"])

_llm = None


def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    return _llm


class RecipeRequest(BaseModel):
    session_id: int | None = None
    message: str | None = None
    hall: str | None = None
    meal: str | None = None
    cuisine: str | None = None
    goals: list[str] | None = None
    dt: str | None = None


class RecipeResponse(BaseModel):
    session_id: int
    reply: str


class RecipeSessionOut(BaseModel):
    id: int
    title: str
    updated_at: str


@router.get("/recipe/sessions", response_model=list[RecipeSessionOut])
def list_recipe_sessions(user=Depends(get_current_user), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT id, title, updated_at FROM recipe_sessions WHERE user_id = ? ORDER BY updated_at DESC",
        (user["id"],),
    ).fetchall()
    return [RecipeSessionOut(id=r["id"], title=r["title"], updated_at=r["updated_at"]) for r in rows]


@router.get("/recipe/sessions/{session_id}/messages")
def get_recipe_session_messages(session_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    row = conn.execute(
        "SELECT id FROM recipe_sessions WHERE id = ? AND user_id = ?", (session_id, user["id"])
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    msgs = conn.execute(
        "SELECT role, content FROM recipe_messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    return {"messages": [{"role": m["role"], "content": m["content"]} for m in msgs]}


@router.delete("/recipe/sessions/{session_id}", status_code=204)
def delete_recipe_session(session_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    row = conn.execute(
        "SELECT id FROM recipe_sessions WHERE id = ? AND user_id = ?", (session_id, user["id"])
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    conn.execute("DELETE FROM recipe_messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM recipe_sessions WHERE id = ?", (session_id,))
    conn.commit()


def _fetch_available_items(hall: str, meal: str, dt: str) -> tuple[str, str]:
    """Build a text summary of all items + ingredients available for a hall/meal/date.

    Returns (menu_text, actual_date_used).  Falls back to the closest date
    with data if the exact date has nothing.
    """
    conn = get_connection()
    try:
        _QUERY = """\
            SELECT fi.name, me.station, fn.ingredients, fn.calories,
                   fn.protein_g, fn.total_fat_g, fn.total_carbs_g,
                   fn.serving_size
            FROM menu_entries me
            JOIN dining_halls dh ON dh.id = me.hall_id
            JOIN food_items fi ON fi.id = me.food_item_id
            LEFT JOIN food_nutrition fn ON fn.food_item_id = fi.id
            WHERE dh.name LIKE ? AND LOWER(me.meal) = LOWER(?) AND me.date = ?
            ORDER BY me.station, fi.name
        """

        rows = conn.execute(_QUERY, (f"%{hall}%", meal, dt)).fetchall()
        used_date = dt

        if not rows:
            nearest = conn.execute(
                """\
                SELECT DISTINCT me.date
                FROM menu_entries me
                JOIN dining_halls dh ON dh.id = me.hall_id
                WHERE dh.name LIKE ? AND LOWER(me.meal) = LOWER(?)
                ORDER BY ABS(JULIANDAY(me.date) - JULIANDAY(?))
                LIMIT 1
                """,
                (f"%{hall}%", meal, dt),
            ).fetchone()
            if nearest:
                used_date = nearest["date"]
                rows = conn.execute(
                    _QUERY, (f"%{hall}%", meal, used_date)
                ).fetchall()

        if not rows:
            return ("", dt)

        lines = []
        current_station = None
        for r in rows:
            if r["station"] != current_station:
                current_station = r["station"]
                lines.append(f"\n## {current_station}")
            macros = ""
            if r["calories"] is not None:
                macros = (
                    f" | {r['calories']} cal, "
                    f"{r['protein_g'] or 0}g protein, "
                    f"{r['total_fat_g'] or 0}g fat, "
                    f"{r['total_carbs_g'] or 0}g carbs"
                )
            serving = ""
            if r["serving_size"]:
                serving = f" | Serving: {r['serving_size']}"
            ingredients = ""
            if r["ingredients"]:
                ingredients = f"\n  Ingredients: {r['ingredients']}"
            lines.append(f"- **{r['name']}**{macros}{serving}{ingredients}")

        return ("\n".join(lines), used_date)
    finally:
        conn.close()


_RECIPE_SYSTEM_PROMPT = """\
You are **TerpDining Recipe Creator**, a creative chef AI for University of Maryland students.

You help students create delicious meals and recipe combinations using the ingredients and food items currently available at their dining hall.

## CRITICAL RULES — follow these exactly
1. **ONLY use items from the menu below.** Every ingredient in your recipes MUST appear in the "Available Menu Items" list. Do NOT invent, assume, or suggest ANY item that is not explicitly listed.
2. Do NOT say "if available" or "check if they have" — you already know exactly what is available.  If an item is not on the list, it does not exist at this dining hall right now.
3. Be creative with combinations — students can grab items from different stations and mix them.
4. For each recipe, list the **exact menu items used** with their macros, then show the **total macros** (sum them up).
5. Format each recipe with: Recipe Name, Items Used (with macros), How to Assemble, Total Nutrition.
6. Respect the user's dietary goals and cuisine preferences.
7. Suggest 2-3 recipe ideas per request.
8. Keep suggestions practical — students are assembling these at a dining hall, not cooking in a kitchen.

## Available Menu Items for {hall} — {meal} on {date}
{menu_items}
"""


@router.post("/recipe", response_model=RecipeResponse)
def recipe(body: RecipeRequest, user=Depends(get_current_user), conn=Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()

    if body.session_id:
        row = conn.execute(
            "SELECT id FROM recipe_sessions WHERE id = ? AND user_id = ?",
            (body.session_id, user["id"]),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        session_id = body.session_id

        if not body.message:
            raise HTTPException(status_code=400, detail="message required for follow-up")

        conn.execute(
            "INSERT INTO recipe_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, "user", body.message, now),
        )
        conn.commit()
    else:
        hall = body.hall or "South Campus"
        meal = body.meal or "Lunch"
        dt = body.dt or date.today().isoformat()
        cuisine = body.cuisine or "anything"
        goals = ", ".join(body.goals) if body.goals else "no specific goals"

        menu_text, actual_date = _fetch_available_items(hall, meal, dt)

        if not menu_text:
            raise HTTPException(
                status_code=404,
                detail=f"No menu data for {hall} {meal} on {dt}. Try a different date or dining hall.",
            )

        system_msg = _RECIPE_SYSTEM_PROMPT.format(
            menu_items=menu_text, hall=hall, meal=meal, date=actual_date
        )

        date_note = ""
        if actual_date != dt:
            date_note = f"\n(Note: no data for {dt}, showing menu from {actual_date})"

        user_prompt = (
            f"I'm eating at **{hall}** for **{meal}** on {actual_date}.{date_note}\n"
            f"Cuisine I'm craving: **{cuisine}**\n"
            f"Dietary goals: **{goals}**\n\n"
            f"Please suggest some creative meal combinations using what's available!"
        )

        title = f"Recipe: {cuisine} ({hall}, {meal})"
        if len(title) > 60:
            title = title[:57] + "..."
        cur = conn.execute(
            "INSERT INTO recipe_sessions (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (user["id"], title, now, now),
        )
        conn.commit()
        session_id = cur.lastrowid

        conn.execute(
            "INSERT INTO recipe_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, "system", system_msg, now),
        )
        conn.execute(
            "INSERT INTO recipe_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, "user", user_prompt, now),
        )
        conn.commit()

    prev_msgs = conn.execute(
        "SELECT role, content FROM recipe_messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    messages = [{"role": m["role"], "content": m["content"]} for m in prev_msgs]

    llm = _get_llm()
    ai_response = llm.invoke(messages)
    reply = ai_response.content

    conn.execute(
        "INSERT INTO recipe_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, "assistant", reply, datetime.now(timezone.utc).isoformat()),
    )
    conn.execute(
        "UPDATE recipe_sessions SET updated_at = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), session_id),
    )
    conn.commit()

    return RecipeResponse(session_id=session_id, reply=reply)
