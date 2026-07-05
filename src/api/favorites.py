"""User favorite menu items."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.deps import get_current_user, get_db

router = APIRouter(prefix="/api", tags=["favorites"])


class FavoriteIn(BaseModel):
    name: str


class FavoriteOut(BaseModel):
    name: str


def _norm_name(s: str) -> str:
    return " ".join(s.strip().split())


@router.get("/favorites", response_model=list[FavoriteOut])
def list_favorites(user=Depends(get_current_user), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT food_name FROM user_favorite_foods WHERE user_id = ? ORDER BY LOWER(food_name)",
        (user["id"],),
    ).fetchall()
    return [FavoriteOut(name=r["food_name"]) for r in rows]


@router.post("/favorites", response_model=FavoriteOut)
def add_favorite(body: FavoriteIn, user=Depends(get_current_user), conn=Depends(get_db)):
    name = _norm_name(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO user_favorite_foods (user_id, food_name, created_at) VALUES (?, ?, ?) "
        "ON CONFLICT (user_id, food_name) DO UPDATE SET created_at = excluded.created_at",
        (user["id"], name, now),
    )
    conn.commit()
    return FavoriteOut(name=name)


@router.delete("/favorites/{food_name:path}", status_code=204)
def remove_favorite(food_name: str, user=Depends(get_current_user), conn=Depends(get_db)):
    name = _norm_name(food_name)
    conn.execute(
        "DELETE FROM user_favorite_foods WHERE user_id = ? AND food_name = ?",
        (user["id"], name),
    )
    conn.commit()
