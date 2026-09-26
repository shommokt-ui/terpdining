# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TerpDining: a UMD dining hall app (web + iOS/Android via Capacitor). Menu browsing, a macro tracker, AI recipe suggestions from what's actually on the menu, and dish reviews. FastAPI backend, React 19 frontend, unofficial/not affiliated with UMD. Live at https://terpdining-web.onrender.com/.

## Commands

Backend (repo root):
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt        # requirements.txt + pytest/httpx

python -m uvicorn server:app --reload      # http://127.0.0.1:8000
python -m pytest tests/ -q                 # full suite
python -m pytest tests/test_tracker.py -q  # one file
python -m pytest tests/test_tracker.py::test_log_food_and_read_back -q  # one test

python run_scraper.py                      # scrape current week into the configured DB (see Two databases below)
python run_scraper.py --start 2026-04-09 --days 3 --no-nutrition
python run_loader.py                       # load pre-scraped JSON from data/ instead of scraping live
```

Frontend (`frontend/`):
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # vite build -> dist/
npm run lint      # eslint .
```

CI (`.github/workflows/ci.yml`) runs `pytest tests/ -q` and, in `frontend/`, `npm run lint` + `npm run build`. Both must pass; there's no separate frontend test suite.

Mobile (after any frontend change meant for the native apps):
```bash
cd frontend && npm run build && npx cap sync ios      # or android
npx cap open ios                                       # then Product > Run in Xcode
```
`npx cap sync` only updates the native project's copy of the web build — it does not rebuild or relaunch the app. A stale-looking native app almost always means Xcode/Android Studio hasn't actually rebuilt.

## Architecture

### Two databases behind one interface

`src/db/models.get_connection()` returns either a `sqlite3.Connection` or a `PostgresConnection` shim (same `execute(sql, params)` surface, `?` placeholders translated to `%s`), chosen by environment:

- `DATABASE_URL` set **and** no explicit path passed → Postgres (production, e.g. Neon on Render).
- Otherwise → SQLite at `DINING_DB_PATH` or `./umd_dining.db` (local dev, tests, and any script/route that explicitly passes a `db_path`).

All SQL in the codebase is written in the common dialect subset both accept. When writing raw SQL with a `LIKE` pattern or other `%`-containing literal, pass it as a bound parameter — `PostgresConnection.execute` does a naive `?` → `%s` string replace, so a literal `%` in inline SQL breaks it on Postgres only.

Schema + seed dining halls live in `src/db/models.py` (`init_db`, `_SQLITE_SCHEMA_SQL` / `_POSTGRES_SCHEMA_SQL`, `DINING_HALLS_SEED`). Tests get a fresh SQLite file per session (`tests/conftest.py`) with tables wiped between tests; `tests/conftest.py` also unsets `DATABASE_URL` so tests never touch Postgres.

### Scraper → DB → API → frontend

`src/scraping/scraper.py` (`scrape_to_db`) pulls menus and nutrition labels from `nutrition.umd.edu` and UMD's dining site, writing through `get_connection()` — so it goes to whichever database the environment points at. Production data is refreshed either by running the scraper manually with `DATABASE_URL` set, or by `server.py`'s own `BackgroundScheduler` (`_rescrape` every 24h, `_scrape_if_stale` on every startup to backfill a Render free-tier instance that's been asleep). `run_loader.py` + `src/db/loader.py` is the alternate path: load already-scraped JSON files instead of hitting UMD live.

Core tables: `dining_halls`, `food_items` (name + `label_url`, a real link to the UMD nutrition-facts page), `food_nutrition` (one row per food item — `serving_size` is UMD's own text label like `"4 oz"` or `"1 each"`, never a gram weight), `menu_entries` (hall + date + meal + station → food item), `food_item_tags` (dietary badges). `food_logs`/`user_goals` back the tracker, `reviews` are scoped per `(food_item_id, hall_id)`.

Important data quirk: UMD gives the **same-named dish a different `food_item_id` per dining hall** (different recipe number, different `serving_size`/macros) — e.g. two different "Scrambled Eggs" rows. Anything that looks up food by name needs to account for this rather than assuming one row per dish; `src/api/nutrition_search.py` and `frontend/src/components/FoodSearch.jsx` group by name and disambiguate by hall for this reason.

Each FastAPI router in `src/api/` is mounted in `server.py` and is a thin SQL layer over `get_connection()` — no ORM. `src/api/deps.py` has the shared `get_db` (per-request connection) and JWT auth deps (`get_current_user`, `get_current_user_optional` for endpoints readable by guests).

### Frontend state

Routing and pages are plain: `frontend/src/App.jsx` → `pages/*.jsx`. Per-page UI state that should survive navigating away and back (search query, selected hall/date/meal, open modals) lives in `frontend/src/context/NavigationStateContext.jsx` rather than local `useState`, keyed by page (`menu`, `tracker`, `recipe`) — check there before adding new page-level state.

`frontend/src/api.js` is the only place that calls `fetch`; it reads `VITE_API_URL` (empty in dev, the Render URL in the mobile/prod build) and attaches the JWT from `AuthContext`.

### Recipe Creator

`src/api/recipe.py` uses `langchain_openai.ChatOpenAI` (`gpt-4o-mini`) to turn the day's actual menu (by hall/meal, pulled from the DB, not fabricated) into recipe suggestions, threaded as chat-style sessions (`recipe_sessions`/`recipe_messages`). Needs `OPENAI_API_KEY`; `server.py` disables LangSmith tracing automatically when the key is missing/a placeholder rather than spamming 403s.

### Mobile (Capacitor)

One React codebase ships to web, iOS, and Android via Capacitor (`frontend/capacitor.config.json`, `frontend/ios/`, `frontend/android/`). Outbound links (nutrition-facts pages, etc.) go through `frontend/src/components/ExternalLink.jsx`, which opens an in-app browser (`@capacitor/browser`) on native instead of ejecting to the system browser, and behaves like a normal link on web.
