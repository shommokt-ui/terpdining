"""DB + auth deps."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from src.db.models import get_connection

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

_bearer = HTTPBearer()
_bearer_optional = HTTPBearer(auto_error=False)


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    conn=Depends(get_db),
) -> dict:
    token = creds.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    row = conn.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {"id": row["id"], "email": row["email"]}


def get_current_user_optional(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
    conn=Depends(get_db),
) -> dict | None:
    """Like get_current_user, but returns None instead of raising when the
    token is missing or invalid. Used by endpoints that are readable by guests
    but want to know the caller's identity when present.
    """
    if creds is None:
        return None
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        user_id = int(sub)
    except (JWTError, ValueError):
        return None

    row = conn.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    return {"id": row["id"], "email": row["email"]}
