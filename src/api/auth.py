"""Auth routes — register, login, me, change-password, forgot/reset password."""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from src.api.deps import create_access_token, get_current_user, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

log = logging.getLogger(__name__)

PASSWORD_RESET_TTL = timedelta(hours=1)
PASSWORD_MIN_LEN = 6
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
RESEND_API_KEY = (os.getenv("RESEND_API_KEY") or "").strip()
RESEND_FROM = os.getenv("RESEND_FROM", "TerpDining <onboarding@resend.dev>")


def _send_reset_email(to_email: str, reset_link: str) -> None:
    """Send the password-reset link via Resend, if configured.

    Falls back to a server log line (as before) when RESEND_API_KEY is
    absent, so local dev doesn't need a Resend account.
    """
    if not RESEND_API_KEY:
        log.warning(
            "Password reset requested for %s — RESEND_API_KEY not set, link: %s",
            to_email,
            reset_link,
        )
        return

    import resend

    resend.api_key = RESEND_API_KEY
    try:
        resend.Emails.send({
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": "Reset your TerpDining password",
            "html": (
                f"<p>Click the link below to reset your TerpDining password:</p>"
                f'<p><a href="{reset_link}">{reset_link}</a></p>'
                f"<p>This link expires in {int(PASSWORD_RESET_TTL.total_seconds() // 60)} minutes.</p>"
            ),
        })
    except Exception:
        log.exception("Failed to send password reset email to %s", to_email)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    email: str


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, conn=Depends(get_db)):
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    now = datetime.now(timezone.utc).isoformat()
    hashed = _hash_password(body.password)
    cursor = conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
        (body.email, hashed, now),
    )
    conn.commit()
    user_id = cursor.lastrowid

    token = create_access_token({"sub": str(user_id)})
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "email": body.email},
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, conn=Depends(get_db)):
    row = conn.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        (body.email,),
    ).fetchone()
    if not row or not _verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": str(row["id"])})
    return TokenResponse(
        access_token=token,
        user={"id": row["id"], "email": row["email"]},
    )


@router.get("/me", response_model=UserResponse)
def me(user=Depends(get_current_user)):
    return UserResponse(**user)


def _ensure_password_resets_table(conn):
    """Migration — create password_resets if it does not exist."""
    conn.execute(
        """\
        CREATE TABLE IF NOT EXISTS password_resets (
            token      TEXT    NOT NULL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT    NOT NULL,
            used_at    TEXT,
            created_at TEXT    NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id)"
    )
    conn.commit()


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=PASSWORD_MIN_LEN)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    """Change the current user's password after verifying the existing one."""
    row = conn.execute(
        "SELECT password_hash FROM users WHERE id = ?", (user["id"],)
    ).fetchone()
    if not row or not _verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different",
        )
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (_hash_password(body.new_password), user["id"]),
    )
    conn.commit()
    return {"ok": True}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, conn=Depends(get_db)):
    """Kick off a password-reset flow.

    Always returns 200 so the client can't probe for which emails are registered.
    If the email matches a real user, a single-use token is generated and the
    reset link is emailed via Resend (falls back to a server log line when
    RESEND_API_KEY isn't configured).
    """
    _ensure_password_resets_table(conn)

    row = conn.execute(
        "SELECT id, email FROM users WHERE email = ?", (body.email,)
    ).fetchone()
    if row:
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires_at = (now + PASSWORD_RESET_TTL).isoformat()
        conn.execute(
            "INSERT INTO password_resets (token, user_id, expires_at, created_at) "
            "VALUES (?, ?, ?, ?)",
            (token, row["id"], expires_at, now.isoformat()),
        )
        conn.commit()
        reset_link = f"{FRONTEND_BASE_URL}/reset-password?token={token}"
        _send_reset_email(row["email"], reset_link)

    return {"ok": True}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=PASSWORD_MIN_LEN)


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, conn=Depends(get_db)):
    """Consume a reset token and set a new password."""
    _ensure_password_resets_table(conn)

    row = conn.execute(
        "SELECT pr.user_id, pr.expires_at, pr.used_at, u.email "
        "FROM password_resets pr JOIN users u ON u.id = pr.user_id "
        "WHERE pr.token = ?",
        (body.token,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if row["used_at"]:
        raise HTTPException(status_code=400, detail="This reset link has already been used")
    try:
        expires = datetime.fromisoformat(row["expires_at"])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset link has expired")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (_hash_password(body.new_password), row["user_id"]),
    )
    conn.execute(
        "UPDATE password_resets SET used_at = ? WHERE token = ?",
        (now, body.token),
    )
    conn.commit()

    token = create_access_token({"sub": str(row["user_id"])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": row["user_id"], "email": row["email"]},
    }
