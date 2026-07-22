"""Favorites CRUD, auth gating, and name normalization."""

from __future__ import annotations


def test_favorites_require_auth(client):
    assert client.get("/api/favorites").status_code in (401, 403)
    assert client.post("/api/favorites", json={"name": "Pizza"}).status_code in (401, 403)
    assert client.delete("/api/favorites/Pizza").status_code in (401, 403)


def test_add_list_delete_roundtrip(client, auth_headers):
    assert client.get("/api/favorites", headers=auth_headers).json() == []

    resp = client.post("/api/favorites", json={"name": "Chicken Tikka Masala"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"name": "Chicken Tikka Masala"}

    names = [f["name"] for f in client.get("/api/favorites", headers=auth_headers).json()]
    assert names == ["Chicken Tikka Masala"]

    assert client.delete("/api/favorites/Chicken%20Tikka%20Masala", headers=auth_headers).status_code == 204
    assert client.get("/api/favorites", headers=auth_headers).json() == []


def test_add_favorite_normalizes_whitespace(client, auth_headers):
    resp = client.post("/api/favorites", json={"name": "  Apple   Pie  "}, headers=auth_headers)
    assert resp.json() == {"name": "Apple Pie"}


def test_add_favorite_is_idempotent(client, auth_headers):
    for _ in range(2):
        client.post("/api/favorites", json={"name": "Waffles"}, headers=auth_headers)
    names = [f["name"] for f in client.get("/api/favorites", headers=auth_headers).json()]
    assert names == ["Waffles"]


def test_blank_favorite_rejected(client, auth_headers):
    resp = client.post("/api/favorites", json={"name": "   "}, headers=auth_headers)
    assert resp.status_code == 400
