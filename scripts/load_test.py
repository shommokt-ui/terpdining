"""Bounded, read-only HTTP load test for TerpDining.

Example: python scripts/load_test.py --url https://terpdining.onrender.com --output /tmp/terpdining-load.json
The target is never modified. Keep this out of CI.
"""

import argparse
import asyncio
import json
import math
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx


def percentile(values, pct):
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * pct / 100
    lo = math.floor(position)
    hi = math.ceil(position)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (position - lo)


def summarize(records, elapsed):
    times = [r["seconds"] for r in records if r["ok"]]
    errors = [r for r in records if not r["ok"]]
    return {
        "requests": len(records), "rps": round(len(records) / max(elapsed, .001), 2),
        "p50_ms": round(percentile(times, 50) * 1000, 1) if times else None,
        "p95_ms": round(percentile(times, 95) * 1000, 1) if times else None,
        "p99_ms": round(percentile(times, 99) * 1000, 1) if times else None,
        "error_percent": round(100 * len(errors) / max(len(records), 1), 2),
        "errors": dict(Counter(r["error"] for r in errors)),
        "by_route": {route: {
            "requests": sum(r["route"] == route for r in records),
            "p95_ms": round(percentile([r["seconds"] for r in records if r["route"] == route and r["ok"]], 95) * 1000, 1)
            if any(r["route"] == route and r["ok"] for r in records) else None,
        } for route in sorted({r["route"] for r in records})},
    }


async def request(client, route, params, records):
    start = time.perf_counter()
    try:
        response = await client.get(route, params=params)
        ok = response.status_code == 200
        error = None if ok else f"HTTP {response.status_code}"
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        ok, error = False, type(exc).__name__
    records.append({"route": route, "ok": ok, "error": error,
                    "seconds": time.perf_counter() - start})


async def visitor(client, routes, deadline, records):
    index = 0
    while time.monotonic() < deadline:
        route, params = routes[index % len(routes)]
        await request(client, route, params, records)
        index += 1
        # A person pauses between page actions. This is not a requests/second flood.
        await asyncio.sleep(.35)


async def window(client, routes, users, seconds):
    records = []
    start = time.monotonic()
    deadline = start + seconds
    await asyncio.gather(*(visitor(client, routes, deadline, records) for _ in range(users)))
    return summarize(records, time.monotonic() - start)


def stop_reason(summary, previous_slow, memory_mb=None, memory_limit_mb=512):
    if memory_mb is not None and memory_mb >= .9 * memory_limit_mb:
        return "memory_near_limit"
    if summary["error_percent"] > 1:
        return "errors_over_1_percent"
    slow = summary["p95_ms"] is not None and summary["p95_ms"] > 1000
    if slow and previous_slow:
        return "p95_over_1_second_twice"
    return None


def read_metrics(path):
    if path is None:
        return None
    try:
        data = json.loads(Path(path).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    return {key: data.get(key) for key in ("memory_mb", "cpu_percent", "db_connections", "restarts", "observed_at")}


async def main(args):
    parsed = urlparse(args.url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise SystemExit("--url must be an absolute HTTP(S) URL")
    if parsed.hostname not in ("127.0.0.1", "localhost") and parsed.scheme != "https":
        raise SystemExit("Remote load targets require HTTPS")
    stages = [1, 2, 5, 10, 20, 40]
    while stages[-1] < args.max_users:
        stages.append(stages[-1] * 2)
    stages = [n for n in stages if n <= args.max_users]
    timeout = httpx.Timeout(args.timeout)
    limits = httpx.Limits(max_connections=max(args.max_users * 2, 20))
    result = {"url": args.url, "started_at": datetime.now(timezone.utc).isoformat(),
              "target_p95_ms": 1000, "window_seconds": args.window,
              "max_seconds": args.max_seconds, "stages": [], "first_health_probe_seconds": None,
              "cold_start_confirmed": False,
              "resource_metrics": "Unavailable unless --metrics-file supplies Render/database observations"}
    async with httpx.AsyncClient(base_url=args.url, timeout=timeout, limits=limits) as client:
        start = time.perf_counter()
        response = await client.get("/api/health")
        result["first_health_probe_seconds"] = round(time.perf_counter() - start, 3)
        response.raise_for_status()
        # A warmed menu request gives the actual date and IDs for the review query.
        menu = (await client.get("/api/menu/browse")).json()
        date = args.date or menu.get("date")
        if args.date:
            menu = (await client.get("/api/menu/browse", params={"dt": args.date})).json()
        if not args.date and not menu.get("halls") and menu.get("latest_date"):
            date = menu["latest_date"]
            menu = (await client.get("/api/menu/browse", params={"dt": date})).json()
        hall, food_ids = None, []
        for hall_name, meals in menu.get("halls", {}).items():
            ids = [item["food_item_id"] for stations in meals.values()
                   for items in stations.values() for item in items]
            if ids:
                hall, food_ids = hall_name, list(dict.fromkeys(ids))[:40]
                break
        if not food_ids:
            raise SystemExit("No menu entries found; refusing to benchmark empty responses")
        routes = [
            ("/api/menu/browse", {"dt": date}),
            ("/api/reviews/summary", {"ids": ",".join(map(str, food_ids)), "hall": hall}),
            ("/api/nutrition/search", {"q": "chicken"}),
        ]
        result["date"] = date
        result["hall"] = hall
        print(f"Preflight: date={date}, hall={hall}, review IDs={len(food_ids)}, first health={result['first_health_probe_seconds']}s", flush=True)
        # Warm separately; this result never counts toward the load threshold.
        result["warmup"] = await window(client, routes, 1, args.warmup)
        print(f"Warmup: {result['warmup']['p95_ms']}ms p95", flush=True)
        start_run = time.monotonic()
        previous_slow = False
        reason = "max_users_reached"
        for users in stages:
            if time.monotonic() - start_run >= args.max_seconds:
                reason = "time_limit"
                break
            duration = min(args.window, args.max_seconds - (time.monotonic() - start_run))
            if duration < 1:
                reason = "time_limit"
                break
            summary = await window(client, routes, users, duration)
            summary["users"] = users
            summary["resources"] = read_metrics(args.metrics_file)
            result["stages"].append(summary)
            print(f"{users} users: {summary['rps']} rps, p95={summary['p95_ms']}ms, errors={summary['error_percent']}%", flush=True)
            resources = summary["resources"] or {}
            reason = "service_restart" if resources.get("restarts") else stop_reason(
                summary, previous_slow, resources.get("memory_mb"))
            previous_slow = summary["p95_ms"] is not None and summary["p95_ms"] > 1000
            if reason:
                break
        result["stop_reason"] = reason
        result["elapsed_seconds"] = round(time.monotonic() - start_run, 1)
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
    print(f"Saved {args.output}; stop={reason}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--date")
    parser.add_argument("--window", type=float, default=30)
    parser.add_argument("--warmup", type=float, default=10)
    parser.add_argument("--timeout", type=float, default=10)
    parser.add_argument("--max-seconds", type=float, default=900)
    parser.add_argument("--max-users", type=int, default=320)
    parser.add_argument("--metrics-file", help="Optional JSON snapshot with memory_mb, cpu_percent, db_connections, restarts, observed_at")
    asyncio.run(main(parser.parse_args()))
