"""Dish reviews: 1-5 star rating + optional comment.

Fully public and append-only: anyone (signed in or not) can read and post.
Each review carries an optional display name (blank shows as "Anonymous").
No editing or deleting.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from src.api.deps import get_current_user_optional, get_db

router = APIRouter(prefix="/api/reviews", tags=["reviews"])

NAME_MAX = 40
COMMENT_MAX = 1000


class ReviewIn(BaseModel):
    food_item_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=COMMENT_MAX)
    name: str | None = Field(default=None, max_length=NAME_MAX)


class ReviewOut(BaseModel):
    id: int
    rating: int
    comment: str | None
    author: str
    created_at: str


class ReviewListOut(BaseModel):
    food_item_id: int
    average: float | None
    count: int
    reviews: list[ReviewOut]


class SummaryOut(BaseModel):
    average: float
    count: int


def _clean(text: str | None, limit: int) -> str | None:
    if text is None:
        return None
    text = " ".join(text.strip().split()) if limit == NAME_MAX else text.strip()
    if not text:
        return None
    return text[:limit]


@router.get("/summary", response_model=dict[str, SummaryOut])
def reviews_summary(ids: str = Query(..., description="Comma-separated food_item_ids"), conn=Depends(get_db)):
    """Batch average + count for many dishes, so menu rows can show stars."""
    id_list: list[int] = []
    for part in ids.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            id_list.append(int(part))
        except ValueError:
            continue
    if not id_list:
        return {}

    placeholders = ",".join("?" for _ in id_list)
    rows = conn.execute(
        f"""\
        SELECT food_item_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt
        FROM reviews
        WHERE food_item_id IN ({placeholders})
        GROUP BY food_item_id
        """,
        tuple(id_list),
    ).fetchall()
    return {
        str(r["food_item_id"]): SummaryOut(average=round(float(r["avg_rating"]), 2), count=r["cnt"])
        for r in rows
    }


@router.get("/{food_item_id}", response_model=ReviewListOut)
def list_reviews(food_item_id: int, conn=Depends(get_db)):
    rows = conn.execute(
        """\
        SELECT id, rating, comment, author_name, created_at
        FROM reviews
        WHERE food_item_id = ?
        ORDER BY created_at DESC, id DESC
        """,
        (food_item_id,),
    ).fetchall()

    reviews: list[ReviewOut] = []
    total = 0
    for r in rows:
        total += r["rating"]
        reviews.append(
            ReviewOut(
                id=r["id"],
                rating=r["rating"],
                comment=r["comment"],
                author=r["author_name"] or "Anonymous",
                created_at=r["created_at"],
            )
        )

    count = len(reviews)
    average = round(total / count, 2) if count else None
    return ReviewListOut(food_item_id=food_item_id, average=average, count=count, reviews=reviews)


@router.post("", response_model=ReviewOut)
def create_review(body: ReviewIn, user=Depends(get_current_user_optional), conn=Depends(get_db)):
    exists = conn.execute(
        "SELECT id FROM food_items WHERE id = ?", (body.food_item_id,)
    ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Dish not found")

    name = _clean(body.name, NAME_MAX)
    if not name and user:
        row = conn.execute(
            "SELECT display_name, email FROM users WHERE id = ?", (user["id"],)
        ).fetchone()
        if row:
            name = (row["display_name"] or "").strip() or row["email"].split("@")[0]

    comment = _clean(body.comment, COMMENT_MAX)
    now = datetime.now(timezone.utc).isoformat()
    row = conn.execute(
        """\
        INSERT INTO reviews (food_item_id, user_id, author_name, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?) RETURNING id
        """,
        (body.food_item_id, user["id"] if user else None, name, body.rating, comment, now),
    ).fetchone()
    conn.commit()

    return ReviewOut(
        id=row["id"],
        rating=body.rating,
        comment=comment,
        author=name or "Anonymous",
        created_at=now,
    )
