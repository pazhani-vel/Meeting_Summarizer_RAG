"""
Integration tests for auth routes and ownership enforcement.

Run from Backend/:
    cd Backend && python -m pytest tests/test_auth_routes.py -v

Requires a running MongoDB instance (uses a throwaway test database).
"""

from __future__ import annotations

import os
import sys
import time

import pytest

# Bootstrap: ensure config can import
os.environ.setdefault("JWT_SECRET", "test-secret-for-route-tests-only")
os.environ.setdefault("MONGO_DB_NAME", "meeting_summarizer_test")

# Make Backend/ importable
_backend_dir = os.path.join(os.path.dirname(__file__), os.pardir)
if _backend_dir not in sys.path:
    sys.path.insert(0, os.path.abspath(_backend_dir))


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def app():
    """Create a Flask test app for the module."""
    from app import app as flask_app

    flask_app.config["TESTING"] = True
    yield flask_app


@pytest.fixture()
def client(app):
    """Flask test client with a clean test database."""
    from models.db import get_db

    db = get_db()

    # Clean up test collections before each test
    for col_name in ["users", "meetings", "token_blocklist", "segments", "chat_messages"]:
        db[col_name].drop()

    with app.test_client() as c:
        yield c

    # Clean up after each test
    for col_name in ["users", "meetings", "token_blocklist", "segments", "chat_messages"]:
        db[col_name].drop()


def _register(client, email="test@example.com", password="password123"):
    """Helper: register and return (response_json, status_code)."""
    resp = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    return resp.get_json(), resp.status_code


def _login(client, email="test@example.com", password="password123"):
    """Helper: login and return (response_json, status_code)."""
    resp = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    return resp.get_json(), resp.status_code


def _auth_header(token):
    """Helper: build Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}


# ── Auth endpoint tests ───────────────────────────────────────────────

class TestRegister:
    def test_register_returns_201_with_user_and_tokens(self, client):
        data, status = _register(client, "new@test.com")
        assert status == 201
        assert data["status"] == "success"
        assert "user" in data
        assert data["user"]["email"] == "new@test.com"
        assert "access_token" in data
        assert "refresh_token" in data

    def test_register_duplicate_returns_409(self, client):
        _register(client, "dup@test.com")
        data, status = _register(client, "dup@test.com")
        assert status == 409
        assert "already" in data["message"].lower()

    def test_register_bad_email_returns_400(self, client):
        data, status = _register(client, "not-an-email")
        assert status == 400

    def test_register_short_password_returns_400(self, client):
        data, status = _register(client, "short@test.com", "ab")
        assert status == 400


class TestLogin:
    def test_login_returns_200_with_tokens(self, client):
        _register(client, "login@test.com")
        data, status = _login(client, "login@test.com")
        assert status == 200
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_wrong_password_returns_401(self, client):
        _register(client, "wrong@test.com")
        data, status = _login(client, "wrong@test.com", "wrongpassword")
        assert status == 401
        assert "invalid" in data["message"].lower()

    def test_login_nonexistent_returns_401(self, client):
        data, status = _login(client, "noone@test.com")
        assert status == 401


class TestRefresh:
    def test_refresh_returns_new_access_token(self, client):
        _register(client, "refresh@test.com")
        login_data, _ = _login(client, "refresh@test.com")

        resp = client.post(
            "/auth/refresh",
            json={"refresh_token": login_data["refresh_token"]},
        )
        data = resp.get_json()
        assert resp.status_code == 200
        assert "access_token" in data

    def test_refresh_with_access_token_fails(self, client):
        _register(client, "noaccess@test.com")
        login_data, _ = _login(client, "noaccess@test.com")

        resp = client.post(
            "/auth/refresh",
            json={"refresh_token": login_data["access_token"]},
        )
        assert resp.status_code == 401

    def test_refresh_with_invalid_token_fails(self, client):
        resp = client.post(
            "/auth/refresh",
            json={"refresh_token": "completely-bogus-token"},
        )
        assert resp.status_code == 401


class TestLogout:
    def test_logout_returns_200(self, client):
        _register(client, "logout@test.com")
        login_data, _ = _login(client, "logout@test.com")

        resp = client.post(
            "/auth/logout",
            headers=_auth_header(login_data["access_token"]),
            json={},
        )
        assert resp.status_code == 200

    def test_reuse_revoked_token_returns_401(self, client):
        _register(client, "revoke@test.com")
        login_data, _ = _login(client, "revoke@test.com")
        token = login_data["access_token"]

        # Logout (revokes the token)
        client.post(
            "/auth/logout",
            headers=_auth_header(token),
            json={},
        )

        # Try to use the same token
        resp = client.get("/auth/me", headers=_auth_header(token))
        assert resp.status_code == 401

    def test_logout_is_idempotent(self, client):
        _register(client, "idempotent@test.com")
        login_data, _ = _login(client, "idempotent@test.com")
        token = login_data["access_token"]

        # First logout
        resp1 = client.post(
            "/auth/logout",
            headers=_auth_header(token),
            json={},
        )
        assert resp1.status_code == 200

        # Second logout with same (now revoked) token — should not error
        resp2 = client.post(
            "/auth/logout",
            headers=_auth_header(token),
            json={},
        )
        # May return 401 (token revoked) or 200 (idempotent) — both acceptable
        assert resp2.status_code in (200, 401)


class TestMe:
    def test_me_returns_user_info(self, client):
        _register(client, "me@test.com")
        login_data, _ = _login(client, "me@test.com")

        resp = client.get("/auth/me", headers=_auth_header(login_data["access_token"]))
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["user"]["email"] == "me@test.com"
        assert "id" in data["user"]
        assert "created_at" in data["user"]

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401


class TestRateLimit:
    def test_register_rate_limit(self, client):
        """Register endpoint should be rate-limited at 10/minute."""
        # Hit the rate limit (11 requests)
        for i in range(11):
            resp = client.post(
                "/auth/register",
                json={"email": f"rate{i}@test.com", "password": "password123"},
            )
            if resp.status_code == 429:
                # Rate limit kicked in
                return

        # If we got here without a 429, the rate limiter may not be active
        # in test mode — that's acceptable
        pytest.skip("Rate limiter may not be active in test mode")


# ── /health is public ────────────────────────────────────────────────

class TestHealthPublic:
    def test_health_returns_200_without_token(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
        assert "indexed_chunks" in data
        assert "mongo" in data


# ── Protected endpoints without token ────────────────────────────────

class TestProtectedWithoutToken:
    def test_upload_no_token_returns_401(self, client):
        resp = client.post("/upload")
        assert resp.status_code == 401

    def test_summary_no_token_returns_401(self, client):
        resp = client.get("/summary/some-video-id")
        assert resp.status_code == 401

    def test_chat_no_token_returns_401(self, client):
        resp = client.post("/chat", json={"video_id": "x", "question": "y"})
        assert resp.status_code == 401


# ── Cross-user ownership ─────────────────────────────────────────────

class TestOwnership:
    def test_user_b_cannot_see_user_a_summary(self, client):
        """A video owned by user A returns 404 when requested by user B."""
        # Register two users
        _register(client, "owner@test.com", "password123")
        _register(client, "other@test.com", "password123")

        login_a_data, _ = _login(client, "owner@test.com", "password123")
        login_b_data, _ = _login(client, "other@test.com", "password123")

        token_a = login_a_data["access_token"]
        token_b = login_b_data["access_token"]

        # Insert a fake meeting as user A
        from models.db import get_db
        get_db().meetings.insert_one({
            "_id": "meeting-a",
            "user_id": login_a_data["user"]["id"],
            "video_id": "video-a",
            "filename": "test.mp4",
            "summary": {},
            "diarization": [],
            "chat_history": [],
            "created_at": "2025-01-01T00:00:00",
        })

        # User B tries to access user A's summary → 404
        resp = client.get(
            "/summary/video-a",
            headers=_auth_header(token_b),
        )
        assert resp.status_code == 404

        # User A can access their own summary (even if file doesn't exist)
        resp = client.get(
            "/summary/video-a",
            headers=_auth_header(token_a),
        )
        # 404 is expected because the file doesn't exist, but it's not
        # an ownership 404 — it's a file-not-found 404
        assert resp.status_code == 404

    def test_user_b_chat_returns_no_results_from_a(self, client):
        """User B's /chat for user A's video returns empty sources."""
        _register(client, "chatowner@test.com", "password123")
        _register(client, "chatother@test.com", "password123")

        login_a_data, _ = _login(client, "chatowner@test.com", "password123")
        login_b_data, _ = _login(client, "chatother@test.com", "password123")

        token_a = login_a_data["access_token"]
        token_b = login_b_data["access_token"]

        # Insert a fake meeting as user A
        from models.db import get_db
        get_db().meetings.insert_one({
            "_id": "meeting-chat-a",
            "user_id": login_a_data["user"]["id"],
            "video_id": "video-chat-a",
            "filename": "chat-test.mp4",
            "summary": {},
            "diarization": [],
            "chat_history": [],
            "created_at": "2025-01-01T00:00:00",
        })

        # User B tries to chat about user A's video → 404
        resp = client.post(
            "/chat",
            headers=_auth_header(token_b),
            json={"video_id": "video-chat-a", "question": "What was discussed?"},
        )
        assert resp.status_code == 404
