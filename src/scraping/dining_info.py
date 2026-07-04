"""Scraper for UMD Dining student-info pages (plans, policies, sick meals, etc.)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from bs4 import BeautifulSoup, Tag

from src.scraping.base import (
    chunk_text,
    create_session,
    extract_sections,
    fetch_and_save,
    now_iso,
)

log = logging.getLogger(__name__)

DOMAIN = "dining"

DINING_INFO_URLS = [
    "https://dining.umd.edu/students/resident-plans",
    "https://dining.umd.edu/students/connector-plans",
    "https://dining.umd.edu/students/dining-dollars-flexible-discounted-and-convenient",
    "https://dining.umd.edu/students/nutrition-allergies-and-special-diets",
    "https://dining.umd.edu/students/student-employment-opportunities",
    "https://dining.umd.edu/students/sick-meals",
]

REQUEST_DELAY = 1.0


def _parse_table(table: Tag) -> list[dict[str, str]]:
    """Parse an HTML <table> into a list of dicts keyed by header text."""
    headers: list[str] = []
    for th in table.select("thead th, thead td, tr:first-child th"):
        headers.append(th.get_text(strip=True))

    if not headers:
        first_row = table.find("tr")
        if first_row:
            headers = [cell.get_text(strip=True) for cell in first_row.find_all(["th", "td"])]

    rows: list[dict[str, str]] = []
    body_rows = table.select("tbody tr") or table.find_all("tr")[1:]
    for tr in body_rows:
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if not cells or all(c == "" for c in cells):
            continue
        row = {}
        for i, cell in enumerate(cells):
            key = headers[i] if i < len(headers) else f"col_{i}"
            row[key] = cell
        rows.append(row)
    return rows


def _classify_plan_type(url: str) -> str:
    if "resident" in url:
        return "resident"
    if "connector" in url:
        return "connector"
    if "dining-dollars" in url:
        return "dining_dollars"
    return "other"


def _extract_meal_plans(soup: BeautifulSoup, url: str) -> list[dict[str, Any]]:
    """Extract meal plan tables from a dining info page."""
    plan_type = _classify_plan_type(url)
    plans: list[dict[str, Any]] = []
    ts = now_iso()

    for table in soup.find_all("table"):
        rows = _parse_table(table)
        for row in rows:
            cols = list(row.values())
            name = cols[0] if cols else ""
            if not name:
                continue

            plan: dict[str, Any] = {
                "plan_type": plan_type,
                "plan_name": name,
                "meals": None,
                "dining_dollars": None,
                "guest_passes": None,
                "price": None,
                "notes": None,
                "scraped_at": ts,
            }

            headers_lower = {k.lower(): v for k, v in row.items()}

            for key in headers_lower:
                val = headers_lower[key]
                if "meal" in key and "break" not in key:
                    plan["meals"] = val
                if "dining dollar" in key or key == "dd":
                    plan["dining_dollars"] = val
                if "guest" in key:
                    plan["guest_passes"] = val
                if "price" in key:
                    plan["price"] = val
                if "bundle" in key:
                    plan["plan_name"] = val
                if "breakdown" in key or "saving" in key:
                    plan["notes"] = val

            if plan["price"] is None:
                for val in cols[1:]:
                    if "$" in val:
                        plan["price"] = val
                        break

            plans.append(plan)

    return plans


def _extract_contacts(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Try to extract contact information (name, email, phone) from a page."""
    contacts: list[dict[str, Any]] = []
    ts = now_iso()
    text = soup.get_text()

    email_pattern = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
    phone_pattern = re.compile(r"\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")

    emails = email_pattern.findall(text)
    phones = phone_pattern.findall(text)

    for email in emails:
        contacts.append({
            "domain": DOMAIN,
            "name": None,
            "role": None,
            "phone": phones[0] if phones else None,
            "email": email,
            "scraped_at": ts,
        })

    return contacts


def _extract_documents(soup: BeautifulSoup, url: str, title: str) -> list[dict[str, Any]]:
    """Extract page content as chunked documents."""
    ts = now_iso()
    sections = extract_sections(soup)
    docs: list[dict[str, Any]] = []

    for section in sections:
        section_title = section["title"] or title
        chunks = chunk_text(section["content"])
        for i, chunk in enumerate(chunks):
            docs.append({
                "domain": DOMAIN,
                "source_url": url,
                "source_type": "html",
                "title": title,
                "section": section_title,
                "content": chunk,
                "chunk_index": i,
                "scraped_at": ts,
            })

    return docs


def scrape_dining_info() -> dict[str, Any]:
    """Scrape all 6 dining info pages.

    Returns dict with keys: meal_plans, contacts, documents.
    """
    session = create_session()
    all_plans: list[dict] = []
    all_contacts: list[dict] = []
    all_docs: list[dict] = []

    for url in DINING_INFO_URLS:
        log.info("Scraping dining info: %s", url)
        soup, _ = fetch_and_save(session, url, DOMAIN)

        title_tag = soup.find("h1")
        title = title_tag.get_text(strip=True) if title_tag else url.split("/")[-1]

        plans = _extract_meal_plans(soup, url)
        if plans:
            log.info("  Found %d meal plan rows", len(plans))
        all_plans.extend(plans)

        contacts = _extract_contacts(soup)
        all_contacts.extend(contacts)

        docs = _extract_documents(soup, url, title)
        log.info("  Extracted %d document chunks", len(docs))
        all_docs.extend(docs)

        time.sleep(REQUEST_DELAY)

    return {
        "meal_plans": all_plans,
        "contacts": all_contacts,
        "documents": all_docs,
    }
