"""Dish reviews: 1-5 star rating + optional comment, one per user per dish.

Reads are public (guests can see ratings); writing/deleting requires auth.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from src.api.deps import get_current_user, get_current_user_optional, get_db

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewIn(BaseModel):
    food_item_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


class ReviewOut(BaseModel):
    id: int
    rating: int
    comment: str | None
    author: str
    created_at: str
    is_mine: bool


class ReviewListOut(BaseModel):
    food_item_id: int
    average: float | None
    count: int
    my_review: ReviewOut | None
    reviews: list[ReviewOut]


class SummaryOut(BaseModel):
    average: float
    count: int


def _author_label(display_name: str | None, email: str) -> str:
    name = (display_name or "").strip()
    if name:
        return name
    return email.split("@")[0]


def _clean_comment(comment: str | None) -> str | None:
    if comment is None:
        return None
    text = comment.strip()
    return text or None


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
def list_reviews(
    food_item_id: int,
    user=Depends(get_current_user_optional),
    conn=Depends(get_db),
):
    rows = conn.execute(
        """\
        SELECT r.id, r.rating, r.comment, r.created_at, r.user_id,
               u.email, u.display_name
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.food_item_id = ?
        ORDER BY r.updated_at DESC
        """,
        (food_item_id,),
    ).fetchall()

    my_id = user["id"] if user else None
    reviews: list[ReviewOut] = []
    my_review: ReviewOut | None = None
    total = 0
    for r in rows:
        total += r["rating"]
        is_mine = my_id is not None and r["user_id"] == my_id
        item = ReviewOut(
            id=r["id"],
            rating=r["rating"],
            comment=r["comment"],
            author=_author_label(r["display_name"], r["email"]),
            created_at=r["created_at"],
            is_mine=is_mine,
        )
        reviews.append(item)
        if is_mine:
            my_review = item

    count = len(reviews)
    average = round(total / count, 2) if count else None
    return ReviewListOut(
        food_item_id=food_item_id,
        average=average,
        count=count,
        my_review=my_review,
        reviews=reviews,
    )


@router.post("", response_model=ReviewOut)
def upsert_review(body: ReviewIn, user=Depends(get_current_user), conn=Depends(get_db)):
    exists = conn.execute(
        "SELECT id FROM food_items WHERE id = ?", (body.food_item_id,)
    ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Dish not found")

    comment = _clean_comment(body.comment)
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """\
        INSERT INTO reviews (user_id, food_item_id, rating, comment, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, food_item_id)
        DO UPDATE SET rating = excluded.rating,
                      comment = excluded.comment,
                      updated_at = excluded.updated_at
        """,
        (user["id"], body.food_item_id, body.rating, comment, now, now),
    )
    conn.commit()

    row = conn.execute(
        """\
        SELECT r.id, r.rating, r.comment, r.created_at, u.email, u.display_name
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.user_id = ? AND r.food_item_id = ?
        """,
        (user["id"], body.food_item_id),
    ).fetchone()
    return ReviewOut(
        id=row["id"],
        rating=row["rating"],
        comment=row["comment"],
        author=_author_label(row["display_name"], row["email"]),
        created_at=row["created_at"],
        is_mine=True,
    )


@router.delete("/{food_item_id}", status_code=204)
def delete_review(food_item_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    conn.execute(
        "DELETE FROM reviews WHERE user_id = ? AND food_item_id = ?",
        (user["id"], food_item_id),
    )
    conn.commit()
