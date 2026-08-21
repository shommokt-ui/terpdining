"""Dish reviews: 1-5 star rating + optional comment.

Fully public and append-only: anyone (signed in or not) can read and post.
Each review carries an optional display name (blank shows as "Anonymous").
No editing or deleting.

Because posting is open/anonymous, a lightweight per-IP rate limit plus a
duplicate-submit guard and a small profanity filter are applied on write.
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from src.api.deps import get_current_user_optional, get_db

router = APIRouter(prefix="/api/reviews", tags=["reviews"])

NAME_MAX = 40
COMMENT_MAX = 1000
PAGE_MAX = 50
PAGE_DEFAULT = 10

# --- anti-spam knobs (module-level so tests can tweak / reset) ---------------
RATE_LIMIT_MAX = 8          # max posts per IP within the window
RATE_LIMIT_WINDOW = 60.0    # seconds
DUP_WINDOW = 600.0          # seconds an identical post is treated as a dupe

_post_history: dict[str, list[float]] = {}
_recent_submits: dict[tuple, float] = {}

_SORTS = {
    "newest": "created_at DESC, id DESC",
    "highest": "rating DESC, created_at DESC, id DESC",
    "lowest": "rating ASC, created_at DESC, id DESC",
}

# Small profanity blocklist; matched case-insensitively on word boundaries and
# masked with asterisks (we censor rather than reject to keep posting smooth).
_BAD_WORDS = [
    "fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "piss",
    "slut", "whore", "nigger", "faggot", "retard",
]
_bad_re = re.compile(r"\b(" + "|".join(re.escape(w) for w in _BAD_WORDS) + r")\b", re.IGNORECASE)


def _reset_rate_limit() -> None:
    """Clear the in-memory anti-spam state (used by tests)."""
    _post_history.clear()
    _recent_submits.clear()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _censor(text: str | None) -> str | None:
    if not text:
        return text
    return _bad_re.sub(lambda m: "*" * len(m.group()), text)


def _clean(text: str | None, limit: int) -> str | None:
    if text is None:
        return None
    text = " ".join(text.strip().split()) if limit == NAME_MAX else text.strip()
    if not text:
        return None
    return text[:limit]


def _resolve_hall_id(conn, hall: str | None) -> int | None:
    """Map a dining-hall name to its id. Returns None when unknown/blank so
    callers can decide whether that's an error (write) or an empty set (read)."""
    if not hall or not hall.strip():
        return None
    row = conn.execute(
        "SELECT id FROM dining_halls WHERE name = ?", (hall.strip(),)
    ).fetchone()
    return row["id"] if row else None


def _check_rate_limit(ip: str, dup_key: tuple) -> None:
    now = time.time()

    # prune + enforce per-IP window
    history = [t for t in _post_history.get(ip, []) if now - t < RATE_LIMIT_WINDOW]
    if len(history) >= RATE_LIMIT_MAX:
        _post_history[ip] = history
        raise HTTPException(status_code=429, detail="You're posting too fast. Please wait a bit.")

    # duplicate guard
    last = _recent_submits.get(dup_key)
    if last is not None and now - last < DUP_WINDOW:
        raise HTTPException(status_code=429, detail="This looks like a duplicate of a review you just posted.")

    # record
    history.append(now)
    _post_history[ip] = history
    _recent_submits[dup_key] = now

    # opportunistic cleanup so the dup map doesn't grow unbounded
    if len(_recent_submits) > 5000:
        for k, ts in list(_recent_submits.items()):
            if now - ts >= DUP_WINDOW:
                _recent_submits.pop(k, None)


class ReviewIn(BaseModel):
    food_item_id: int
    hall: str = Field(..., max_length=100)
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
    has_more: bool


class SummaryOut(BaseModel):
    average: float
    count: int


@router.get("/summary", response_model=dict[str, SummaryOut])
def reviews_summary(
    ids: str = Query(..., description="Comma-separated food_item_ids"),
    hall: str | None = Query(None, description="Scope to a single dining hall by name"),
    conn=Depends(get_db),
):
    """Batch average + count for many dishes, so menu rows can show stars.

    When ``hall`` is given, ratings are scoped to that hall (dishes with the
    same id are reviewed separately per hall)."""
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

    hall_id = None
    if hall is not None:
        hall_id = _resolve_hall_id(conn, hall)
        if hall_id is None:
            return {}

    placeholders = ",".join("?" for _ in id_list)
    params: list = list(id_list)
    hall_clause = ""
    if hall_id is not None:
        hall_clause = "AND hall_id = ?"
        params.append(hall_id)

    rows = conn.execute(
        f"""\
        SELECT food_item_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt
        FROM reviews
        WHERE food_item_id IN ({placeholders}) {hall_clause}
        GROUP BY food_item_id
        """,
        tuple(params),
    ).fetchall()
    return {
        str(r["food_item_id"]): SummaryOut(average=round(float(r["avg_rating"]), 2), count=r["cnt"])
        for r in rows
    }


@router.get("/{food_item_id}", response_model=ReviewListOut)
def list_reviews(
    food_item_id: int,
    hall: str | None = Query(None, description="Scope to a single dining hall by name"),
    sort: str = Query("newest"),
    limit: int = Query(PAGE_DEFAULT, ge=1, le=PAGE_MAX),
    offset: int = Query(0, ge=0),
    conn=Depends(get_db),
):
    order_by = _SORTS.get(sort, _SORTS["newest"])

    where = "food_item_id = ?"
    scope: list = [food_item_id]
    if hall is not None:
        hall_id = _resolve_hall_id(conn, hall)
        if hall_id is None:
            return ReviewListOut(
                food_item_id=food_item_id, average=None, count=0, reviews=[], has_more=False
            )
        where += " AND hall_id = ?"
        scope.append(hall_id)

    agg = conn.execute(
        f"SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM reviews WHERE {where}",
        tuple(scope),
    ).fetchone()
    count = agg["cnt"] or 0
    average = round(float(agg["avg_rating"]), 2) if count else None

    rows = conn.execute(
        f"""\
        SELECT id, rating, comment, author_name, created_at
        FROM reviews
        WHERE {where}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
        """,
        tuple(scope) + (limit, offset),
    ).fetchall()

    reviews = [
        ReviewOut(
            id=r["id"],
            rating=r["rating"],
            comment=r["comment"],
            author=r["author_name"] or "Anonymous",
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return ReviewListOut(
        food_item_id=food_item_id,
        average=average,
        count=count,
        reviews=reviews,
        has_more=offset + len(reviews) < count,
    )


@router.post("", response_model=ReviewOut)
def create_review(
    body: ReviewIn,
    request: Request,
    user=Depends(get_current_user_optional),
    conn=Depends(get_db),
):
    exists = conn.execute(
        "SELECT id FROM food_items WHERE id = ?", (body.food_item_id,)
    ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Dish not found")

    hall_id = _resolve_hall_id(conn, body.hall)
    if hall_id is None:
        raise HTTPException(status_code=400, detail="Unknown dining hall")

    name = _censor(_clean(body.name, NAME_MAX))
    if not name and user:
        row = conn.execute(
            "SELECT display_name, email FROM users WHERE id = ?", (user["id"],)
        ).fetchone()
        if row:
            name = (row["display_name"] or "").strip() or row["email"].split("@")[0]

    comment = _censor(_clean(body.comment, COMMENT_MAX))

    ip = _client_ip(request)
    dup_key = (ip, body.food_item_id, hall_id, body.rating, (comment or "").lower())
    _check_rate_limit(ip, dup_key)

    now = datetime.now(timezone.utc).isoformat()
    row = conn.execute(
        """\
        INSERT INTO reviews (food_item_id, hall_id, user_id, author_name, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
        """,
        (body.food_item_id, hall_id, user["id"] if user else None, name, body.rating, comment, now),
    ).fetchone()
    conn.commit()

    return ReviewOut(
        id=row["id"],
        rating=body.rating,
        comment=comment,
        author=name or "Anonymous",
        created_at=now,
    )
