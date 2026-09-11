<p align="center">
  <img src="docs/logo.svg" alt="TerpDining logo" width="96" height="96">
</p>

# TerpDining

[![CI](https://github.com/shommokt-ui/terpdining/actions/workflows/ci.yml/badge.svg)](https://github.com/shommokt-ui/terpdining/actions/workflows/ci.yml)

UMD dining hall app. Check menus, track macros, and get AI recipe ideas from
what's actually on the menu today, on web, iOS, and Android. Unofficial
student project, not affiliated with or endorsed by the University of
Maryland.

**Live: [terpdining-web.onrender.com](https://terpdining-web.onrender.com/)**

## Screenshots

| Menu | Tracker | Recipe Creator |
|---|---|---|
| ![Menu](docs/screenshots/menu.gif) | ![Tracker](docs/screenshots/tracker.png) | ![Recipe](docs/screenshots/recipe.png) |

## What it does

- **Menu**: every dining hall by meal and station, with dietary badges (vegan, halal, allergens) and a date picker.
- **Favorites**: heart an item to get notified when it's back on the menu.
- **Recipes**: AI suggests dishes assembled from what's actually available that day.
- **Tracker**: log food with realistic portions, see daily macros on a donut chart, goals synced across devices.

## Stack

| | |
|---|---|
| Backend  | FastAPI, SQLite, JWT auth, bcrypt |
| Frontend | React 19, Vite, Tailwind v4, React Router |
| Mobile   | Capacitor (iOS + Android) |
| Recipes  | LangChain + OpenAI |
| Scraping | BeautifulSoup, requests, APScheduler |
| Data     | nutrition.umd.edu |
