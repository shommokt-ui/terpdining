# TerpDining load test

This test is deliberately separate from CI. Run production only against the API host and only when a short read-only benchmark is acceptable. The harness calls `/api/health`, `/api/menu/browse`, `/api/reviews/summary`, and `/api/nutrition/search`; it does not send writes to production. Each simulated visitor cycles through the three read routes with a 350 ms pause between actions. The menu preflight selects a real date, hall, and review IDs so empty responses do not give a false capacity figure.

Local isolation:

```bash
DATABASE_URL= .venv/bin/python scripts/prepare_load_db.py --source umd_dining.db --target /tmp/terpdining-load-isolated.db
DATABASE_URL= DINING_DB_PATH=/tmp/terpdining-load-isolated.db ENABLE_SCRAPE_SCHEDULER=false .venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8765
# In another terminal:
.venv/bin/python scripts/load_test.py --url http://127.0.0.1:8765 --output /tmp/local-load.json --window 30
.venv/bin/python scripts/local_mixed_load.py --db /tmp/terpdining-load-isolated.db
.venv/bin/python -m pytest tests/test_load_failure_cases.py -q
```

The mixed test uses a mocked UMD scrape and writes only to the disposable database. Its date is the latest available local menu date. Do not run local workloads at the same time as a production measurement if both share your computer.

Production:

```bash
.venv/bin/python scripts/load_test.py --url https://terpdining.onrender.com --output /tmp/production-load.json
```

The first health probe measures the first request of the test, **not necessarily a cold start**. To measure a cold start, leave the free service idle long enough to spin down, then make a single health request before warmup; do not infer cold status from the request duration alone. The harness warms the service, then runs 30-second windows at 1, 2, 5, 10, 20, 40, and doubled visitor counts. It stops after two consecutive windows above 1 second p95, above 1% errors/timeouts in one window, or 15 minutes. A `--max-users` guard prevents the client computer from trying to create unbounded tasks. The memory threshold is evaluated only if memory readings are supplied to `stop_reason`; the HTTP client cannot obtain Render resource metrics itself.

For each production window, record Render's CPU and memory graphs and the database provider's active connection count at the same timestamps. If a separate observer can write a current JSON snapshot such as `{"memory_mb": 400, "cpu_percent": 80, "db_connections": 12, "restarts": false, "observed_at": "..."}`, pass its path with `--metrics-file`; the harness adds those values to each stage and stops at 90% of 512 MB or a reported restart. Otherwise watch the dashboard and stop the command manually if memory approaches its limit or the service restarts. The HTTP client has no credentials for those private dashboards. Without the resource graphs and connection count, the result establishes an observed latency limit for this test mix but does not identify whether RAM, CPU, or the database caused it.
