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
