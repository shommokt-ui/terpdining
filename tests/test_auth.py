"""Auth flow: register, login, me, and the failure paths."""

from __future__ import annotations


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_register_returns_token_and_user(client):
    resp = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "password123"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "new@example.com"


def test_register_duplicate_email_conflicts(client):
    payload = {"email": "dupe@example.com", "password": "password123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/register", json=payload).status_code == 409


def test_login_roundtrip(client):
    client.post("/api/auth/register", json={"email": "login@example.com", "password": "password123"})
    resp = client.post("/api/auth/login", json={"email": "login@example.com", "password": "password123"})
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "login@example.com"


def test_login_wrong_password_rejected(client):
    client.post("/api/auth/register", json={"email": "wrongpw@example.com", "password": "password123"})
    resp = client.post("/api/auth/login", json={"email": "wrongpw@example.com", "password": "nope"})
    assert resp.status_code == 401


def test_login_unknown_email_rejected(client):
    resp = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "password123"})
    assert resp.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "terp@example.com"


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code in (401, 403)


def test_me_rejects_garbage_token(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert resp.status_code == 401


def test_registration_rejects_short_and_oversized_passwords(client):
    for password in ('', 'short', 'a' * 73, 'é' * 37):
        resp = client.post('/api/auth/register', json={
            'email': 'invalid@example.com', 'password': password,
        })
        assert resp.status_code == 422, resp.text


def test_bcrypt_byte_limit_allows_boundary_and_rejects_oversized_login(client):
    email = 'unicode@example.com'
    password = 'é' * 36  # 72 UTF-8 bytes, although only 36 characters.
    assert client.post('/api/auth/register', json={'email': email, 'password': password}).status_code == 201
    assert client.post('/api/auth/login', json={'email': email, 'password': password}).status_code == 200
    assert client.post('/api/auth/login', json={'email': email, 'password': password + 'é'}).status_code == 401


def test_password_update_endpoints_reject_oversized_password(client, auth_headers):
    resp = client.post('/api/auth/change-password', headers=auth_headers, json={
        'current_password': 'password123', 'new_password': 'a' * 73,
    })
    assert resp.status_code == 422
    resp = client.post('/api/auth/reset-password', json={
        'token': 'irrelevant', 'new_password': 'é' * 37,
    })
    assert resp.status_code == 422
