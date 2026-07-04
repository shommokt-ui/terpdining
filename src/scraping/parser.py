"""Pure HTML parsing helpers for the UMD Dining website.

No HTTP calls — only BeautifulSoup transformations.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin

from bs4 import Tag

BASE_URL = "https://nutrition.umd.edu/"

MEALS = ["Breakfast", "Lunch", "Dinner"]

# UMD uses 3 tabs (Breakfast / Lunch / Dinner) on most days and 2 tabs (Brunch / Dinner) on some weekends.
_DEFAULT_MEALS_BY_COUNT: dict[int, list[str]] = {
    2: ["Brunch", "Dinner"],
    3: ["Breakfast", "Lunch", "Dinner"],
}

_NUTRIENT_RE = re.compile(r"^(.+?)\s*(\d[\d,.]*\s*\w+)$")


def _meal_labels_for_tab_panes(soup: Tag, n_panes: int) -> list[str]:
    """Match each tab-pane to a meal name using nav tab text, with UMD fallbacks."""
    tablist = soup.find("ul", class_="nav-tabs")
    if tablist:
        names = [a.get_text(strip=True) for a in tablist.find_all("a", class_="nav-link")]
        names = [n for n in names if n]
        if len(names) == n_panes:
            return names
    if n_panes in _DEFAULT_MEALS_BY_COUNT:
        return list(_DEFAULT_MEALS_BY_COUNT[n_panes])
    return [f"Meal {i + 1}" for i in range(n_panes)]


# ------------------------------------------------------------------
# Menu page parsing
# ------------------------------------------------------------------

def parse_dietary_tags(row: Tag) -> list[str]:
    """Extract dietary/allergen icon alt-text from a menu-item-row."""
    tags: list[str] = []
    for img in row.find_all("img", class_="nutri-icon"):
        alt = (img.get("alt") or "").strip()
        if alt:
            tags.append(alt)
    return tags


def parse_station(card: Tag) -> dict[str, Any]:
    """Parse a single station card into a dict with name and items list."""
    header_el = (
        card.find("div", class_="card-header")
        or card.find("h3", class_="card-title")
        or card.find("h4", class_="card-title")
    )
    station_name = header_el.get_text(strip=True) if header_el else "Unknown Station"

    items: list[dict[str, Any]] = []
    for row in card.find_all("div", class_="menu-item-row"):
        link = row.find("a", class_="menu-item-name")
        if not link:
            continue
        href = link.get("href", "")
        items.append({
            "name": link.get_text(strip=True),
            "label_url": urljoin(BASE_URL, href) if href else None,
            "dietary_tags": parse_dietary_tags(row),
        })
    return {"station": station_name, "items": items}


def parse_meal_pane(pane: Tag) -> list[dict[str, Any]]:
    """Parse all stations inside a single meal tab-pane."""
    stations: list[dict[str, Any]] = []
    for card in pane.find_all("div", class_="card"):
        parsed = parse_station(card)
        if parsed["items"]:
            stations.append(parsed)
    return stations


def parse_menu_page(soup: Tag, dining_hall: str, location_num: str, dt_iso: str) -> dict[str, Any]:
    """Parse the full menu page soup into a structured dict."""
    tab_content = soup.find("div", class_="tab-content")
    if tab_content:
        tab_panes = tab_content.find_all("div", class_="tab-pane")
    else:
        tab_panes = soup.find_all("div", class_="tab-pane")

    meal_labels = _meal_labels_for_tab_panes(soup, len(tab_panes))
    meals: dict[str, list[dict[str, Any]]] = {}
    for meal_name, pane in zip(meal_labels, tab_panes):
        meals[meal_name] = parse_meal_pane(pane)

    return {
        "dining_hall": dining_hall,
        "location_num": location_num,
        "date": dt_iso,
        "meals": meals,
    }


# ------------------------------------------------------------------
# Nutrition label parsing
# ------------------------------------------------------------------

def parse_nutrient_text(text: str) -> tuple[str, str]:
    """Split 'Total Fat 3.8g' -> ('Total Fat', '3.8g')."""
    text = text.replace("\xa0", " ").strip()
    m = _NUTRIENT_RE.match(text)
    if m:
        name = m.group(1).rstrip("., ")
        return name, m.group(2).strip()
    return text.rstrip("., "), ""


def parse_nutrition_label(soup: Tag, url: str) -> dict[str, Any]:
    """Parse a nutrition-label page soup into a structured dict."""
    title_el = soup.find("h1") or soup.find("h2")
    title = title_el.get_text(strip=True) if title_el else ""

    serv_per_el = soup.find("div", class_="nutfactsservpercont")
    serving_per_container = serv_per_el.get_text(strip=True) if serv_per_el else ""

    serv_size_els = soup.find_all("div", class_="nutfactsservsize")
    serving_size = serv_size_els[1].get_text(strip=True) if len(serv_size_els) > 1 else ""

    calories_text = ""
    for p_tag in soup.find_all("p"):
        if p_tag.get_text(strip=True) == "Calories per serving":
            next_p = p_tag.find_next_sibling("p")
            if next_p:
                calories_text = next_p.get_text(strip=True)
            break

    facts_table = soup.find("table", class_="facts_table")
    nutrients: dict[str, dict[str, str]] = {}
    if facts_table:
        spans = facts_table.find_all("span", class_="nutfactstopnutrient")
        i = 0
        while i < len(spans):
            raw = spans[i].get_text(strip=True)
            dv = ""
            if i + 1 < len(spans):
                dv = spans[i + 1].get_text(strip=True)
            if raw:
                name, amount = parse_nutrient_text(raw)
                nutrients[name] = {"amount": amount, "daily_value": dv}
            i += 2

    ing_el = soup.find("span", class_="labelingredientsvalue")
    ingredients = ing_el.get_text(strip=True) if ing_el else ""

    alg_el = soup.find("span", class_="labelallergensvalue")
    allergens = alg_el.get_text(strip=True) if alg_el else ""

    return {
        "name": title,
        "label_url": url,
        "serving_per_container": serving_per_container,
        "serving_size": serving_size,
        "calories": calories_text,
        "nutrients": nutrients,
        "ingredients": ingredients,
        "allergens": allergens,
    }
