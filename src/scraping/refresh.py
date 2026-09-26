"""Decide when the API's fallback should refresh menus."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def menu_refresh_needed(conn, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(ZoneInfo("America/New_York")).date().isoformat()
    # A future menu doesn't prove today's menu exists, or that it's still fresh.
    row = conn.execute(
        "SELECT MAX(scraped_at) AS refreshed FROM menu_entries WHERE date = ?",
        (today,),
    ).fetchone()
    if not row or not row["refreshed"]:
        return True
    try:
        refreshed = datetime.fromisoformat(row["refreshed"])
        if refreshed.tzinfo is None:
            refreshed = refreshed.replace(tzinfo=timezone.utc)
        return refreshed < now - timedelta(hours=6)
    except (TypeError, ValueError):
        return True
