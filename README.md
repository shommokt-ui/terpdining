<p align="center">
  <img src="docs/logo.svg" alt="TerpDining logo" width="96" height="96">
</p>

# TerpDining

[![CI](https://github.com/shommokt-ui/terpdining/actions/workflows/ci.yml/badge.svg)](https://github.com/shommokt-ui/terpdining/actions/workflows/ci.yml)

UMD dining hall app. Check menus, track macros, and get creative recipes from food thats available on that day, on web and IOS. Unofficial
student project, not affiliated with or endorsed by the University of
Maryland.

**Live: [terpdining-web.onrender.com](https://terpdining-web.onrender.com/)**

## Screenshots

| Menu | Tracker | Recipe Creator |
|---|---|---|
| <img src="docs/screenshots/menu.gif" alt="Menu" width="285"> | <img src="docs/screenshots/tracker.png" alt="Tracker" width="300"> | <img src="docs/screenshots/recipe.png" alt="Recipe" width="300"> |

## What it does

- **Menu**: every dining hall by meal and station, with dietary badges (vegan, halal, allergens) and a date picker.
- **Favorites**: heart an item to get notified when it's back on the menu.
- **Recipes**: AI suggests dishes assembled from what's actually available that day.
- **Tracker**: log food with realistic portions, see daily macros on a donut chart, goals synced across devices.

## Stack

| | |
|---|---|
| Backend  | FastAPI, PostgreSQL (SQLite for tests), JWT auth, bcrypt |
| Frontend | React 19, Vite, Tailwind v4, React Router |
| Mobile   | Capacitor (iOS) |
| Recipes  | LangChain |
| Scraping | BeautifulSoup, requests, APScheduler |
| Data     | nutrition.umd.edu |

## Recipe API setup

To use the recipe generator use whichever AI model you prefer. Just add your API key and model name to the .env file.

