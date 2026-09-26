# Backend package guide

`requirements.txt` lists production dependencies and short purpose comments.
`requirements-dev.txt` adds the tools used by the test suite. Frontend/native
packages are explained in [the frontend guide](../frontend/README.md).

- `langchain[openai]`: installs the OpenAI integration used by
  `src/api/recipe.py`. `ChatOpenAI` sends menu context and conversation messages
  to the model; it does not run a model on the phone.
- `bs4`: installs Beautiful Soup, which reads menu and nutrition HTML in
  `src/scraping/`. Python imports it as `bs4`.
- `python-dotenv`: loads local `.env` configuration in server/scripts.
- `requests`: synchronous HTTP requests for scraping and optional Brevo email.
- `fastapi`: API routes, dependency injection, request validation, and responses.
- `uvicorn[standard]`: runs FastAPI as an HTTP server; the extra includes runtime
  helpers such as reload support.
- `python-jose[cryptography]`: signs and validates the JWT used for account sessions.
- `bcrypt`: hashes/verifies passwords. Passwords are not encrypted for later
  recovery; resets replace the stored hash. New passwords have a 72-byte UTF-8
  limit because bcrypt operates on bytes rather than characters.
- `pydantic[email]`: validates request models and email addresses.
- `apscheduler`: refreshes scraped menus in the background while the server runs.
- `resend`: sends password-reset emails when Resend is configured. Alternative
  delivery uses `requests` for Brevo or Python's built-in `smtplib` for Gmail.
- `psycopg[binary]`: connects to production PostgreSQL without compiling a driver.
  Local SQLite support is built into Python and needs no separate package.
- `pytest` (development): discovers/runs the backend regression tests.
- `httpx` (development): HTTP transport used by FastAPI's in-process test client.

The old Passlib wrapper and multipart form parser were removed: auth imports
bcrypt directly and accepts JSON, and there are no multipart endpoints.

## Python source packages

- `src/api/`: the HTTP boundary. Routers validate input, check ownership, and use
  SQL to return account, menu, nutrition, tracker, favorite, review, and recipe data.
- `src/db/`: schema, seed data, loader, and a common SQLite/PostgreSQL connection
  interface. Bind query values with `?`; the Postgres adapter translates them.
- `src/scraping/`: reads UMD pages and turns them into menu/nutrition database rows.
- `server.py`: assembles the routers, CORS rules, database startup, and scrape jobs.

## Efficiency choices

Menu browsing fetches all dietary tags for the requested date in one query,
instead of making a separate database call for every dish. The frontend cancels
obsolete date requests and loads the recipe Markdown parser only when needed.
These improvements do not replace production load testing; SQLite tests cannot
measure the latency of the hosted PostgreSQL service.

## Automatic menu refresh

With `ENABLE_SCRAPE_SCHEDULER=true`, the API checks today's Maryland menu on
startup and once an hour. Missing menus or data older than six hours trigger a
refresh. A failed attempt retries at the next hourly check. With the flag set to
`false`, both startup and periodic refresh are disabled.

The scraper saves each hall/date before fetching nutrition labels. A failed hall
keeps its previous data while other halls continue; a failed label keeps saved
nutrition. Incomplete runs return a failure so scheduled-job logs expose them.
An unrecognized source page is treated as an error, not an empty menu to publish.

Sleeping web services cannot run background timers. The optional
`.github/workflows/refresh-menus.yml` runs independently every six hours and can
also be started manually from GitHub Actions. To activate it, put the workflow on
the default branch and add the `DATABASE_URL` repository Actions secret pointing
to the **same PostgreSQL database as the Render API**. Keep the connection string
out of source control. The workflow fails explicitly if the secret is missing;
it never silently writes to a disposable SQLite database. Its lighter dependency
list is `requirements-scraper.txt`.

Scheduled GitHub jobs can be delayed or disabled by GitHub (including inactivity
on public repositories), so retain the API fallback and inspect failed runs.
After setup, run the workflow manually once and verify `/api/menu/browse` reports
current dates. Deploying source changes alone does not populate the secret or
change a previously saved Render environment variable.
