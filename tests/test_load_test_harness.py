"""Verify the benchmark's stopping rules independently of the app."""

import pytest

from scripts.load_test import percentile, stop_reason, summarize


def test_percentile_and_rates():
    records = [
        {"route": "/a", "ok": True, "error": None, "seconds": x}
        for x in (.1, .2, .3, .4)
    ] + [{"route": "/a", "ok": False, "error": "ReadTimeout", "seconds": 1}]
    result = summarize(records, 2)
    assert percentile([1, 2, 3, 4], 95) == pytest.approx(3.85)
    assert result["rps"] == 2.5
    assert result["error_percent"] == 20
    assert result["errors"] == {"ReadTimeout": 1}


def test_stopping_rules():
    healthy = {"p95_ms": 900, "error_percent": 0}
    slow = {"p95_ms": 1100, "error_percent": 0}
    assert stop_reason(healthy, False) is None
    assert stop_reason(slow, False) is None
    assert stop_reason(slow, True) == "p95_over_1_second_twice"
    assert stop_reason({"p95_ms": 100, "error_percent": 1.01}, False) == "errors_over_1_percent"
    assert stop_reason(healthy, False, memory_mb=461) == "memory_near_limit"
