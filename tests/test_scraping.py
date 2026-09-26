"""Scraping publishes menus before slow labels and preserves data on failures."""
from datetime import date, datetime, timezone

import pytest

from src.scraping import scraper
from src.scraping.refresh import menu_refresh_needed
from tests.conftest import seed_food
from tests.test_menu_browse import _seed_menu_entry


def menu(name='New dish'):
    return {'meals': {'Lunch': [{'station': 'Test', 'items': [
        {'name': name, 'label_url': f'https://example.com/{name}', 'dietary_tags': ['Vegan']}
    ]}]}}


@pytest.fixture
def fake_source(monkeypatch):
    monkeypatch.setattr(scraper.time, 'sleep', lambda _: None)
    monkeypatch.setattr(scraper, 'scrape_menu', lambda *args: menu())


def test_menus_are_committed_before_any_nutrition_http(db, fake_source, monkeypatch):
    def nutrition(*args):
        rows = db.execute('SELECT DISTINCT hall_id FROM menu_entries').fetchall()
        assert len(rows) == 3  # Another connection can already read every hall.
        return {'name': 'New dish', 'calories': '100'}

    monkeypatch.setattr(scraper, 'scrape_nutrition_label_http', nutrition)
    result = scraper.scrape_to_db(start_date=date(2026, 9, 26), days=1)
    assert sum(result.values()) == 3
    assert db.execute('SELECT calories FROM food_nutrition').fetchone()['calories'] == 100


def test_failed_hall_keeps_old_menu_and_other_halls_refresh(db, fake_source, monkeypatch):
    food = seed_food(db, name='Saved dish')
    _seed_menu_entry(db, food, date='2026-09-26')

    def source(_session, location, _date):
        if location == '16':
            raise TimeoutError('source unavailable')
        return menu()

    monkeypatch.setattr(scraper, 'scrape_menu', source)
    with pytest.raises(RuntimeError, match='1 failed updates'):
        scraper.scrape_to_db(start_date=date(2026, 9, 26), days=1, include_nutrition=False)
    assert db.execute('SELECT COUNT(*) AS n FROM menu_entries').fetchone()['n'] == 3
    assert db.execute('SELECT id FROM menu_entries WHERE food_item_id = ?', (food,)).fetchone()


def test_nutrition_failure_does_not_remove_saved_menus(db, fake_source, monkeypatch):
    def fail(*args):
        raise TimeoutError('slow nutrition server')

    monkeypatch.setattr(scraper, 'scrape_nutrition_label_http', fail)
    with pytest.raises(RuntimeError, match='nutrition:'):
        scraper.scrape_to_db(start_date=date(2026, 9, 26), days=1)
    assert db.execute('SELECT COUNT(*) AS n FROM menu_entries').fetchone()['n'] == 3


def test_malformed_menu_page_does_not_count_as_empty_menu(monkeypatch):
    from bs4 import BeautifulSoup
    monkeypatch.setattr(scraper, 'fetch_soup', lambda *args, **kwargs: BeautifulSoup('<h1>Try later</h1>', 'html.parser'))
    with pytest.raises(ValueError, match='No menu tabs'):
        scraper.scrape_menu(None, '16', date(2026, 9, 26))


def test_future_menu_does_not_hide_missing_today(db):
    food = seed_food(db)
    _seed_menu_entry(db, food, date='2026-09-27')
    assert menu_refresh_needed(db, datetime(2026, 9, 26, 16, tzinfo=timezone.utc))


def test_freshness_uses_campus_date_and_six_hour_age(db):
    food = seed_food(db)
    _seed_menu_entry(db, food, date='2026-09-26')
    db.execute("UPDATE menu_entries SET scraped_at = ?", ('2026-09-26T22:00:00+00:00',))
    db.commit()
    # It's still September 26 in Maryland, despite UTC already being the 27th.
    assert not menu_refresh_needed(db, datetime(2026, 9, 27, 1, tzinfo=timezone.utc))
    db.execute("UPDATE menu_entries SET scraped_at = ?", ('2026-09-26T17:00:00+00:00',))
    db.commit()
    assert menu_refresh_needed(db, datetime(2026, 9, 27, 1, tzinfo=timezone.utc))


def test_database_failure_rolls_back_the_hall_replacement(db, fake_source, monkeypatch):
    food = seed_food(db, name='Saved dish')
    _seed_menu_entry(db, food, date='2026-09-26')
    original_upsert = scraper._upsert_food_item
    calls = 0

    def fail_first(*args):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError('write failed after deleting old rows')
        return original_upsert(*args)

    monkeypatch.setattr(scraper, '_upsert_food_item', fail_first)
    with pytest.raises(RuntimeError, match='1 failed updates'):
        scraper.scrape_to_db(start_date=date(2026, 9, 26), days=1, include_nutrition=False)
    assert db.execute('SELECT id FROM menu_entries WHERE food_item_id = ?', (food,)).fetchone()
    assert db.execute('SELECT COUNT(*) AS n FROM menu_entries').fetchone()['n'] == 3
