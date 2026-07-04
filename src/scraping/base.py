"""Shared HTTP helpers and raw-file persistence for all domain scrapers."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

RAW_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"

MAX_RETRIES = 3
RETRY_BACKOFF = 2

log = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": "UMD-Scraper/1.0 (student project)"})
    return s


def fetch_html(session: requests.Session, url: str, params: dict | None = None) -> str:
    """Fetch a URL and return the raw HTML string, with retry logic."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.text
        except (requests.ConnectionError, requests.Timeout) as exc:
            if attempt == MAX_RETRIES:
                raise
            wait = RETRY_BACKOFF * (2 ** (attempt - 1))
            log.warning("Attempt %d/%d failed for %s, retrying in %ds: %s", attempt, MAX_RETRIES, url, wait, exc)
            time.sleep(wait)


def fetch_soup(session: requests.Session, url: str, params: dict | None = None) -> BeautifulSoup:
    html = fetch_html(session, url, params)
    return BeautifulSoup(html, "html.parser")


def save_raw(content: str | bytes, url: str, domain: str, source_type: str = "html") -> Path:
    """Persist raw content to data/raw/{domain}/{hash}.{ext} + .meta.json."""
    domain_dir = RAW_DIR / domain
    domain_dir.mkdir(parents=True, exist_ok=True)

    if isinstance(content, str):
        data = content.encode()
    else:
        data = content

    sha = hashlib.sha256(data).hexdigest()[:16]
    ext = source_type
    file_path = domain_dir / f"{sha}.{ext}"
    meta_path = domain_dir / f"{sha}.{ext}.meta.json"

    file_path.write_bytes(data)
    meta_path.write_text(json.dumps({
        "url": url,
        "domain": domain,
        "source_type": source_type,
        "sha256": sha,
        "saved_at": now_iso(),
    }, indent=2))

    return file_path


def fetch_and_save(session: requests.Session, url: str, domain: str) -> tuple[BeautifulSoup, Path]:
    """Fetch a page, save raw HTML, and return (soup, raw_path)."""
    html = fetch_html(session, url)
    raw_path = save_raw(html, url, domain, source_type="html")
    soup = BeautifulSoup(html, "html.parser")
    log.info("Fetched and saved %s -> %s", url, raw_path.name)
    return soup, raw_path


def chunk_text(text: str, max_chars: int = 800) -> list[str]:
    """Split text into chunks of roughly max_chars, breaking on paragraph boundaries."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if current and len(current) + len(para) + 2 > max_chars:
            chunks.append(current.strip())
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text.strip()] if text.strip() else []


def extract_sections(soup: BeautifulSoup, heading_tags: tuple[str, ...] = ("h2", "h3")) -> list[dict[str, str]]:
    """Split page content into sections keyed by heading text.

    Returns list of {title, content} dicts.
    """
    sections: list[dict[str, str]] = []
    current_title = ""
    current_parts: list[str] = []

    body = soup.find("main") or soup.find("article") or soup.find("div", class_="content") or soup.body
    if not body:
        return [{"title": "", "content": soup.get_text(separator="\n", strip=True)}]

    for el in body.children:
        if not hasattr(el, "name"):
            continue
        if el.name in heading_tags:
            if current_parts:
                sections.append({"title": current_title, "content": "\n\n".join(current_parts)})
            current_title = el.get_text(strip=True)
            current_parts = []
        else:
            text = el.get_text(separator="\n", strip=True)
            if text:
                current_parts.append(text)

    if current_parts:
        sections.append({"title": current_title, "content": "\n\n".join(current_parts)})

    return sections if sections else [{"title": "", "content": body.get_text(separator="\n", strip=True)}]
