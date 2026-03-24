# 🐢 TerpDining

UMD dining hall app. Check menus, track macros, and get AI recipe ideas from
what's actually on the menu today — on web, iOS, and Android.

> Unofficial student project — not affiliated with or endorsed by the
> University of Maryland.

## Screenshots

| Menu | Tracker |
|---|---|
| ![Menu](docs/screenshots/menu.png) | ![Tracker](docs/screenshots/tracker.png) |

| Recipe Creator |
|---|
| ![Recipe](docs/screenshots/recipe.png) |

## What it does

- **Menu**: see what's at each dining hall by meal and station. Badges flag dietary tags (vegan, halal, allergens, etc.). The date picker lets you browse any day, and out-of-semester dates show a friendly summer message instead of an empty page.
- **Favorites**: heart any menu item to follow it across days. The app pings you when a favorite shows back up on the menu.
- **Recipes**: pick a dining hall and meal, and the AI recipe creator suggests dishes you can actually assemble from what's available that day.
- **Tracker**: log food with realistic portion sizes (slices of pizza, scoops of ice cream, not just "servings"). A donut chart shows your daily macros, and your goals persist server-side so they follow you across devices.

## Stack

| | |
|---|---|
| Backend  | FastAPI, SQLite, JWT auth, bcrypt |
| Frontend | React 19, Vite, Tailwind v4, React Router |
| Mobile   | Capacitor (iOS + Android shells around the React frontend) |
| Recipes  | LangChain + OpenAI (single bounded call per request — no open-ended chat loop) |
| Scraping | BeautifulSoup, requests, APScheduler (daily in-process re-scrape) |
| Email    | Resend (password reset links) |
| Data     | nutrition.umd.edu |

## Structure

```
src/
├── scraping/     # pulls menu + nutrition data from the UMD site
├── db/           # sqlite schema, seeding, migrations
└── api/          # FastAPI routes (auth, menu, recipe, tracker, favorites)

frontend/src/
├── pages/        # Menu, Recipe, Tracker, Login, Register, Settings
├── components/   # Navbar, FoodSearch, DailySummary, ErrorBoundary, etc.
└── context/      # AuthProvider, NavigationStateProvider

android/, ios/    # Capacitor native project shells (generated, see Mobile below)
```

## Running it locally

Need Python 3.11+, Node 18+, and an OpenAI key (only required for the
`/api/recipe` endpoint — everything else works without it).

```bash
# backend
python -m venv .venv
source .venv/bin/activate   # .venv\Scripts\activate on Windows
pip install -r requirements.txt

# env
cp .env.example .env
# fill in OPENAI_API_KEY. Everything else has a safe local default.

# scrape menu data (skip if you already have umd_dining.db)
python run_scraper.py

# frontend
cd frontend && npm install && cd ..

# run both (in separate terminals)
python -m uvicorn server:app --reload   # http://127.0.0.1:8000
cd frontend && npm run dev              # http://localhost:5173
```

Then open http://localhost:5173.

## Env vars

| Var | Required? | What |
|---|---|---|
| `OPENAI_API_KEY`       | for `/api/recipe` | powers the recipe creator |
| `JWT_SECRET`           | yes in prod | signs auth tokens; falls back to an insecure dev value locally |
| `CORS_ALLOWED_ORIGINS` | yes in prod | comma-separated list of allowed frontend origins |
| `FRONTEND_BASE_URL`    | yes in prod | used to build the password-reset link |
| `RESEND_API_KEY`       | for real password-reset emails | leave blank locally to just log the reset link |
| `RESEND_FROM`          | no | sender address/name for reset emails |
| `DINING_DB_PATH`       | for prod persistence | absolute path to the SQLite file (e.g. a Render disk mount) |
| `ENABLE_SCRAPE_SCHEDULER` | no | set `false` to disable the daily in-process re-scrape |
| `LANGSMITH_*`          | no | optional LangChain tracing; auto-disables on a missing/placeholder key |

## Endpoints

| Method | Path | Auth | |
|---|---|---|---|
| POST   | `/api/auth/register`            | no  | create account |
| POST   | `/api/auth/login`               | no  | get token |
| GET    | `/api/auth/me`                  | yes | who am i |
| POST   | `/api/auth/forgot-password`      | no  | email a reset link |
| POST   | `/api/auth/reset-password`       | no  | consume a reset token |
| GET    | `/api/menu/browse?dt=`          | no  | menu for a date |
| GET    | `/api/nutrition/search?q=`      | no  | search foods |
| GET    | `/api/favorites`                | yes | list favorite food names |
| POST   | `/api/favorites`                | yes | add a favorite |
| DELETE | `/api/favorites/{name}`         | yes | remove a favorite |
| POST   | `/api/recipe`                   | yes | make a recipe / continue a recipe session |
| GET    | `/api/recipe/sessions`          | yes | list past recipe sessions |
| GET    | `/api/recipe/sessions/{id}/messages` | yes | messages in a recipe session |
| DELETE | `/api/recipe/sessions/{id}`     | yes | delete a recipe session |
| GET    | `/api/tracker/logs?date=`       | yes | logs for a day |
| POST   | `/api/tracker/logs`             | yes | log food |
| DELETE | `/api/tracker/logs/{id}`        | yes | delete a log |
| GET    | `/api/tracker/summary?date=`    | yes | daily macros |
| GET    | `/api/tracker/goals`            | yes | current macro goals |
| PUT    | `/api/tracker/goals`            | yes | upsert macro goals |

## Deploying the backend (Render)

`render.yaml` at the repo root defines a single web service with a 1GB
persistent disk (so the SQLite file survives redeploys) and the env vars it
needs. In the Render dashboard:

1. New → Blueprint → connect this GitHub repo. Render reads `render.yaml`
   automatically.
2. Set the `sync: false` env vars in the dashboard (they're secrets, not
   committed): `OPENAI_API_KEY`, `RESEND_API_KEY`, `CORS_ALLOWED_ORIGINS`
   (your deployed frontend origin + `capacitor://localhost` is already
   included by default), `FRONTEND_BASE_URL`.
3. Deploy. Confirm `GET https://<your-service>.onrender.com/api/health`
   returns `{"status": "ok"}`.

The menu data re-scrapes automatically once a day from inside the running
service (see `ENABLE_SCRAPE_SCHEDULER` in `server.py`), so you don't need a
separate cron job.

## Deploying the frontend (web)

Build with the production API URL baked in:

```bash
cd frontend
VITE_API_URL=https://<your-service>.onrender.com npm run build
```

Deploy the `frontend/dist` folder to any static host (Render Static Site,
Netlify, Vercel, etc.) and set that host's URL as `FRONTEND_BASE_URL` and in
`CORS_ALLOWED_ORIGINS` on the backend.

## Mobile (Capacitor: iOS + Android)

The mobile apps are the same React frontend wrapped in a native shell via
[Capacitor](https://capacitorjs.com/). One-time setup already done in this
repo (`frontend/capacitor.config.json`, `frontend/android/`,
`frontend/ios/`); the rebuild loop after any frontend change:

```bash
cd frontend
VITE_API_URL=https://<your-service>.onrender.com npm run build
npx cap sync
```

- **Android**: `npx cap open android` (opens Android Studio) → Build →
  Generate Signed Bundle/APK. Buildable entirely on this machine.
- **iOS**: `npx cap open ios` (opens Xcode) → this step **requires a Mac**
  (or a cloud Mac CI like Codemagic/EAS Build) — Xcode doesn't run on
  Windows/Linux. The `ios/` project is already generated and ready to open
  once you have Mac access.

### App store submission checklist (manual — needs your accounts)

- [ ] Apple Developer Program ($99/yr) and Google Play Console ($25
      one-time) accounts.
- [ ] App icon + splash screens — `npx @capacitor/assets generate` from one
      source image generates every required size for both stores.
- [x] Privacy policy page — built into the app at
      `frontend/src/pages/PrivacyPolicyPage.jsx`, served publicly at
      `/privacy` on your deployed site (no login required). Use
      `https://<your-site>/privacy` in both stores' listings.
- [ ] Store listing: screenshots, description, category, age rating, and
      the App Privacy / Data Safety questionnaire — filled in directly in
      App Store Connect / Play Console.
- [ ] Consider adding an "unofficial, not affiliated with the University of
      Maryland" line to the store listing description — using UMD
      branding/colors without affiliation risks review rejection.

## Notes

- Menu data only goes as far back as the most recent scrape. UMD doesn't publish menus during summer break, so out-of-semester dates render a friendly "Terps are enjoying their summer!" empty state.
- Macro goals persist in the `user_goals` table server-side, so they follow you across devices (including between the web and mobile app, since both hit the same backend).
- The frontend wraps the router in an `ErrorBoundary` so a single page crash falls back to a friendly screen instead of a white page.
- The recipe creator's conversation history lives in `recipe_sessions` /
  `recipe_messages` — a leftover-in-spirit but renamed version of what used
  to be shared with a since-removed general-purpose chat assistant (dropped
  to avoid unbounded per-message LLM cost; the recipe endpoint makes one
  bounded call per request instead).
