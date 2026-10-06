from __future__ import annotations

from .conftest import PASSWORD, register


def test_register_sets_httponly_session_and_me_works(client):
    user = register(client)
    assert user["email"] == "ada@example.com"
    cookie = client.cookies.get("tmp_session")
    assert cookie and len(cookie) > 30
    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["display_name"] == "Ada"


def test_cookie_flags(client):
    r = client.post(
        "/api/auth/register",
        json={"email": "flags@example.com", "password": PASSWORD, "display_name": "F"},
    )
    header = r.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=lax" in header


def test_password_is_hashed_not_stored(client):
    from sqlalchemy import select

    from app.db import get_db
    from app.models import User

    register(client)
    db = next(get_db())
    stored = db.scalar(select(User.password_hash))
    assert stored.startswith("$argon2id$") and PASSWORD not in stored


def test_duplicate_email_is_rejected_case_insensitively(client):
    register(client)
    r = client.post(
        "/api/auth/register",
        json={"email": "ADA@example.com", "password": PASSWORD, "display_name": "A"},
    )
    assert r.status_code == 409


def test_short_password_rejected(client):
    r = client.post(
        "/api/auth/register",
        json={"email": "b@example.com", "password": "short", "display_name": "B"},
    )
    assert r.status_code == 422


def test_logout_invalidates_session(client):
    register(client)
    old = client.cookies.get("tmp_session")
    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.set("tmp_session", old)  # replaying the old token must not work
    assert client.get("/api/auth/me").status_code == 401


def test_login_wrong_password_and_lockout(client, make_client):
    register(client)
    other = make_client()
    for _ in range(5):
        r = other.post(
            "/api/auth/login", json={"email": "ada@example.com", "password": "wrong password!"}
        )
        assert r.status_code == 401
    r = other.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert r.status_code == 429


def test_login_unknown_email_same_message(make_client):
    c = make_client()
    r = c.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever123"})
    assert r.status_code == 401
    assert "don't match" in r.json()["detail"]


def test_login_success(client, make_client):
    register(client)
    c = make_client()
    r = c.post("/api/auth/login", json={"email": "Ada@Example.com", "password": PASSWORD})
    assert r.status_code == 200
    assert c.get("/api/auth/me").status_code == 200


def test_state_changing_request_without_csrf_header_is_rejected(app):
    from fastapi.testclient import TestClient

    with TestClient(app) as bare:
        r = bare.post(
            "/api/auth/register",
            json={"email": "c@example.com", "password": PASSWORD, "display_name": "C"},
        )
        assert r.status_code == 403
        assert bare.get("/api/health").status_code == 200  # safe methods are fine


def test_protected_routes_require_login(make_client):
    c = make_client()
    for path in (
        "/api/plants",
        "/api/journal",
        "/api/reminders",
        "/api/dashboard",
        "/api/account/export",
    ):
        assert c.get(path).status_code == 401, path


def test_password_change_signs_out_other_sessions(client, make_client):
    register(client)
    other = make_client()
    other.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    r = client.post(
        "/api/account/password",
        json={"current_password": PASSWORD, "new_password": "a brand new pass"},
    )
    assert r.status_code == 204
    assert client.get("/api/auth/me").status_code == 200
    assert other.get("/api/auth/me").status_code == 401
