#!/usr/bin/env python3
"""FastAPI server for the TerpDining web app.

Usage:
    uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

# Deployment settings take precedence over a developer's local .env file.
load_dotenv()


def _guard_langsmith_tracing() -> None:
    """Disable LangSmith tracing when the API key is missing or a placeholder.

    Avoids the noisy 403 spam in logs when the .env still has the example value.
    """
    key = (os.getenv("LANGSMITH_API_KEY") or "").strip()
    placeholder = (not key) or key.endswith("...") or key in {"lsv2_pt_", "your-key-here"}
    if placeholder:
        for var in ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_TRACING"):
            os.environ[var] = "false"
        os.environ.pop("LANGSMITH_API_KEY", None)
        os.environ.pop("LANGCHAIN_API_KEY", None)
        logging.getLogger(__name__).info(
            "LangSmith tracing disabled (LANGSMITH_API_KEY is missing or placeholder)."
        )


_guard_langsmith_tracing()

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import router as auth_router
from src.api.favorites import router as favorites_router
from src.api.menu_browse import router as menu_router
from src.api.nutrition_search import router as nutrition_router
from src.api.recipe import router as recipe_router
from src.api.reviews import router as reviews_router
from src.api.tracker import router as tracker_router
from src.db.models import get_connection, init_db

_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",  # Capacitor Android WebView (default https scheme)
]

# Env origins extend the defaults (the Capacitor/localhost origins must
# always work for the mobile apps regardless of deployment config).
_cors_env = (os.getenv("CORS_ALLOWED_ORIGINS") or "").strip()
_extra_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
ALLOWED_ORIGINS = _DEFAULT_ORIGINS + [o for o in _extra_origins if o not in _DEFAULT_ORIGINS]

app = FastAPI(title="TerpDining API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(favorites_router)
app.include_router(menu_router)
app.include_router(nutrition_router)
app.include_router(recipe_router)
app.include_router(reviews_router)
app.include_router(tracker_router)

_scheduler = BackgroundScheduler()


@app.on_event("startup")
def on_startup():
    conn = get_connection()
    init_db(conn)
    conn.close()

    def _rescrape() -> None:
        from src.scraping.scraper import scrape_to_db

        logging.getLogger(__name__).info("Running scheduled menu re-scrape")
        try:
            # The scraper publishes menus before fetching slow nutrition pages.
            # Keep nutrition enabled here so the fallback is also self-contained.
            scrape_to_db()
        except Exception:
            logging.getLogger(__name__).exception("Scheduled menu re-scrape failed")

    def _scrape_if_stale() -> None:
        """Recover missing/stale menus on startup and retry while awake."""
        from src.scraping.refresh import menu_refresh_needed

        conn = get_connection()
        try:
            needs_refresh = menu_refresh_needed(conn)
        finally:
            conn.close()
        if needs_refresh:
            logging.getLogger(__name__).info(
                "Today's menu is missing or stale — scraping now"
            )
            _rescrape()

    if (os.getenv("ENABLE_SCRAPE_SCHEDULER") or "true").strip().lower() != "false":
        from datetime import datetime, timezone

        # Run immediately and check hourly. A failed startup refresh should not
        # wait 24 hours to retry. max_instances also prevents overlapping runs.
        _scheduler.add_job(
            _scrape_if_stale, "interval", hours=1, id="rescrape",
            replace_existing=True, next_run_time=datetime.now(timezone.utc),
            max_instances=1, coalesce=True,
        )
        _scheduler.start()


@app.on_event("shutdown")
def on_shutdown():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


@app.get("/api/health")
def health():
    return {"status": "ok"}
