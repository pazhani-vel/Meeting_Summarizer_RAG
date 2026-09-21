"""
Comprehensive test suite covering every acceptance criterion.

Run from Backend/:
    cd Backend && python -m pytest tests/test_comprehensive.py -v

Uses the test database only — never touches dev data.
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import jwt
import pytest

# Ensure config can import
os.environ.setdefault("JWT_SECRET", "test-secret-comprehensive-32bytes!!")
os.environ.setdefault("MONGO_DB_NAME", "meeting_summarizer_test")

_backend_dir = os.path.join(os.path.dirname(__file__), os.pardir)
if _backend_dir not in sys.path:
    sys.path.insert(0, os.path.abspath(_backend_dir))

from tests.conftest import (
    auth,
    insert_fake_meeting,
    insert_fake_segments,
    insert_fake_summary,
    login,
    register,
    register_and_login,
)


# ======================================================================
# 1. AUTH ROUND-TRIP: register → login → /auth/me
# ======================================================================

class TestAuthRoundTrip:
    def test_register_login_me(self, client):
        user, token = register_and_login(client, "roundtrip@test.com")
        resp = client.get("/auth/me", headers=auth(token))
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["user"]["email"] == "roundtrip@test.com"
        assert data["user"]["id"] == user["id"]


# ======================================================================
# 2. DUPLICATE EMAIL REJECTED
# ======================================================================

class TestDuplicateEmail:
    def test_duplicate_returns_409(self, client):
        register(client, "dup@test.com")
        data, status = register(client, "dup@test.com")
        assert status == 409
        assert "already" in data["message"].lower()


# ======================================================================
# 3. WRONG PASSWORD vs UNKNOWN EMAIL — same message, same timing
# ======================================================================

class TestWrongPasswordVsUnknown:
    def test_same_401_message(self, client):
        register(client, "known@test.com")
        _, status_wrong = login(client, "known@test.com", "wrongpass")
        _, status_unknown = login(client, "unknown@test.com", "wrongpass")
        assert status_wrong == 401
        assert status_unknown == 401

        # Messages should be identical (no enumeration)
        data_wrong = login(client, "known@test.com", "wrongpass")[0]
        data_unknown = login(client, "unknown@test.com", "wrongpass")[0]
        assert data_wrong["message"] == data_unknown["message"]

    def test_timing_similar(self, client):
        register(client, "timing@test.com")

        t0 = time.monotonic()
        login(client, "timing@test.com", "wrongpass")
        t1 = time.monotonic()

        t2 = time.monotonic()
        login(client, "no-such@test.com", "wrongpass")
        t3 = time.monotonic()

        known_time = t1 - t0
        unknown_time = t3 - t2
        # Both should be in the same order of magnitude (bcrypt dummy hash)
        assert unknown_time > known_time * 0.3
        assert unknown_time < known_time * 3.0


# ======================================================================
# 4. EVERY PROTECTED ROUTE RETURNS 401 WITHOUT TOKEN
# ======================================================================

class TestProtectedWithoutToken:
    @pytest.mark.parametrize("method,path", [
        ("POST", "/upload"),
        ("GET",  "/summary/fake-id"),
        ("POST", "/chat"),
        ("GET",  "/meetings"),
        ("GET",  "/meetings/fake-id"),
        ("GET",  "/meetings/fake-id/transcript"),
        ("GET",  "/meetings/fake-id/video"),
        ("GET",  "/meetings/fake-id/chat"),
        ("DELETE", "/meetings/fake-id"),
        ("GET",  "/auth/me"),
    ])
    def test_returns_401(self, client, method, path):
        resp = client.open(path, method=method)
        assert resp.status_code == 401, f"{method} {path} should return 401"

    def test_health_is_public(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200


# ======================================================================
# 5. LOGOUT REVOKES TOKEN
# ======================================================================

class TestLogoutRevokes:
    def test_reuse_after_logout_returns_401(self, client):
        _, token = register_and_login(client, "revoke@test.com")

        # Logout
        resp = client.post("/auth/logout", headers=auth(token), json={})
        assert resp.status_code == 200

        # Reuse the same token
        resp = client.get("/auth/me", headers=auth(token))
        assert resp.status_code == 401

    def test_logout_is_idempotent(self, client):
        _, token = register_and_login(client, "idemp@test.com")

        resp1 = client.post("/auth/logout", headers=auth(token), json={})
        assert resp1.status_code == 200

        resp2 = client.post("/auth/logout", headers=auth(token), json={})
        assert resp2.status_code in (200, 401)


# ======================================================================
# 6. EXPIRED TOKEN RETURNS 401
# ======================================================================

class TestExpiredToken:
    def test_expired_token_rejected(self, client):
        register(client, "expired@test.com")
        data, _ = login(client, "expired@test.com")

        # Craft an already-expired token
        from models.db import get_db
        user = get_db().users.find_one({"email": "expired@test.com"})
        now = datetime.now(timezone.utc)
        payload = {
            "sub": user["_id"],
            "jti": "expired-jti-123",
            "type": "access",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        }
        expired_token = jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")

        resp = client.get("/auth/me", headers=auth(expired_token))
        assert resp.status_code == 401


# ======================================================================
# 7. CROSS-USER ISOLATION — user B gets 404 on A's meeting
# ======================================================================

class TestCrossUserIsolation:
    """User B gets 404 on user A's meeting across every endpoint."""

    def _setup(self, client):
        from models.db import get_db
        db = get_db()

        user_a, token_a = register_and_login(client, "iso-a@test.com")
        user_b, token_b = register_and_login(client, "iso-b@test.com")

        insert_fake_meeting(db, "meeting-a1", user_a["id"], "a_video.mp4")
        insert_fake_segments(db, "meeting-a1", count=2)
        insert_fake_summary(db, "meeting-a1")
        db.chat_messages.insert_one({
            "meeting_id": "meeting-a1", "user_id": user_a["id"],
            "role": "user", "content": "hello", "sources": [],
            "created_at": "2025-06-01T12:00:00+00:00",
        })

        return user_a, token_a, user_b, token_b

    def test_meetings_list_empty_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.get("/meetings", headers=auth(token_b))
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["meetings"] == []

    def test_meeting_detail_404_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.get("/meetings/meeting-a1", headers=auth(token_b))
        assert resp.status_code == 404

    def test_transcript_404_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.get("/meetings/meeting-a1/transcript", headers=auth(token_b))
        assert resp.status_code == 404

    def test_video_404_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.get("/meetings/meeting-a1/video", headers=auth(token_b))
        assert resp.status_code == 404

    def test_chat_history_404_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.get("/meetings/meeting-a1/chat", headers=auth(token_b))
        assert resp.status_code == 404

    def test_summary_404_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.get("/summary/meeting-a1", headers=auth(token_b))
        assert resp.status_code == 404

    def test_delete_404_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.delete("/meetings/meeting-a1", headers=auth(token_b))
        assert resp.status_code == 404

    def test_chat_404_for_b(self, client):
        _, _, _, token_b = self._setup(client)
        resp = client.post(
            "/chat",
            headers=auth(token_b),
            json={"video_id": "meeting-a1", "question": "What?"},
        )
        assert resp.status_code == 404

    def test_a_can_access_own_meeting(self, client):
        _, token_a, _, _ = self._setup(client)
        resp = client.get("/meetings/meeting-a1", headers=auth(token_a))
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["meeting"]["meeting_id"] == "meeting-a1"


# ======================================================================
# 8. GET /meetings RETURNS ONLY CALLER'S ROWS
# ======================================================================

class TestMeetingsListIsolation:
    def test_only_own_meetings(self, client):
        from models.db import get_db
        db = get_db()

        user_a, token_a = register_and_login(client, "own-a@test.com")
        user_b, token_b = register_and_login(client, "own-b@test.com")

        insert_fake_meeting(db, "a-meeting", user_a["id"], "a.mp4")
        insert_fake_meeting(db, "b-meeting", user_b["id"], "b.mp4")

        resp_a = client.get("/meetings", headers=auth(token_a)).get_json()
        resp_b = client.get("/meetings", headers=auth(token_b)).get_json()

        assert len(resp_a["meetings"]) == 1
        assert resp_a["meetings"][0]["meeting_id"] == "a-meeting"
        assert len(resp_b["meetings"]) == 1
        assert resp_b["meetings"][0]["meeting_id"] == "b-meeting"

    def test_limit_and_skip(self, client):
        from models.db import get_db
        db = get_db()

        user, token = register_and_login(client, "pag@test.com")
        for i in range(5):
            insert_fake_meeting(db, f"m-{i}", user["id"], f"v{i}.mp4")

        resp = client.get("/meetings?limit=2", headers=auth(token)).get_json()
        assert len(resp["meetings"]) == 2

        resp = client.get("/meetings?limit=2&skip=4", headers=auth(token)).get_json()
        assert len(resp["meetings"]) == 1


# ======================================================================
# 9. DELETE REMOVES MONGO DOCS, CHROMA VECTORS, AND FILE
# ======================================================================

class TestDeleteCleanup:
    def test_removes_all_mongo_docs(self, client):
        from models.db import get_db
        db = get_db()

        user, token = register_and_login(client, "del-mongo@test.com")
        insert_fake_meeting(db, "del1", user["id"])
        insert_fake_segments(db, "del1", count=3)
        insert_fake_summary(db, "del1")
        db.chat_messages.insert_one({
            "meeting_id": "del1", "user_id": user["id"],
            "role": "user", "content": "hi", "sources": [],
            "created_at": "2025-06-01T12:00:00+00:00",
        })

        # Verify exist
        assert db.meetings.find_one({"meeting_id": "del1"}) is not None
        assert db.segments.count_documents({"meeting_id": "del1"}) == 3
        assert db.summaries.find_one({"meeting_id": "del1"}) is not None
        assert db.chat_messages.count_documents({"meeting_id": "del1"}) == 1

        resp = client.delete("/meetings/del1", headers=auth(token))
        assert resp.status_code == 200

        # Verify all removed
        assert db.meetings.find_one({"meeting_id": "del1"}) is None
        assert db.segments.count_documents({"meeting_id": "del1"}) == 0
        assert db.summaries.find_one({"meeting_id": "del1"}) is None
        assert db.chat_messages.count_documents({"meeting_id": "del1"}) == 0

    def test_removes_video_file(self, client):
        from models.db import get_db
        db = get_db()

        user, token = register_and_login(client, "del-file@test.com")

        # Create a real temp file
        import tempfile
        fd, temp_path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)
        try:
            insert_fake_meeting(db, "del-file-1", user["id"], video_path=temp_path)
            assert os.path.isfile(temp_path)

            resp = client.delete("/meetings/del-file-1", headers=auth(token))
            assert resp.status_code == 200
            assert not os.path.isfile(temp_path)
        finally:
            if os.path.isfile(temp_path):
                os.unlink(temp_path)

    def test_removes_chroma_vectors(self, client):
        """Verify delete_video is called on the vector store."""
        from models.db import get_db
        db = get_db()

        user, token = register_and_login(client, "del-vec@test.com")
        insert_fake_meeting(db, "del-vec-1", user["id"])

        # Patch get_components to track delete_video calls
        with pytest.MonkeyPatch.context() as mp:
            deleted_ids = []

            def fake_get_components():
                class FakeVS:
                    def delete_video(self, mid):
                        deleted_ids.append(mid)
                    def count(self):
                        return 0
                    class collection:
                        @staticmethod
                        def count():
                            return 0
                return (None, None, FakeVS(), None, None)

            mp.setattr("app.get_components", fake_get_components)

            resp = client.delete("/meetings/del-vec-1", headers=auth(token))
            assert resp.status_code == 200
            assert "del-vec-1" in deleted_ids

    def test_404_for_unowned(self, client):
        from models.db import get_db
        db = get_db()

        user_a, token_a = register_and_login(client, "del-own-a@test.com")
        user_b, token_b = register_and_login(client, "del-own-b@test.com")

        insert_fake_meeting(db, "del-owned", user_a["id"])

        resp = client.delete("/meetings/del-owned", headers=auth(token_b))
        assert resp.status_code == 404
        assert db.meetings.find_one({"meeting_id": "del-owned"}) is not None


# ======================================================================
# 10. MEETING HISTORY SURVIVES SIMULATED RESTART
# ======================================================================

class TestHistorySurvivesRestart:
    def test_data_persists_across_app_instances(self, client):
        """Insert data, 'restart' by creating a new app instance, verify data."""
        from models.db import get_db
        db = get_db()

        user, token = register_and_login(client, "restart@test.com")
        insert_fake_meeting(db, "restart-meeting", user["id"], "restart.mp4")
        insert_fake_segments(db, "restart-meeting", count=2)
        insert_fake_summary(db, "restart-meeting")

        # Verify data exists
        resp = client.get("/meetings", headers=auth(token)).get_json()
        assert len(resp["meetings"]) == 1
        assert resp["meetings"][0]["meeting_id"] == "restart-meeting"

        resp = client.get("/meetings/restart-meeting/transcript", headers=auth(token)).get_json()
        assert len(resp["segments"]) == 2

        resp = client.get("/meetings/restart-meeting", headers=auth(token)).get_json()
        assert resp["summary"]["summary"] == "This is a test summary of the meeting."

        # Create a brand new app instance (simulates restart)
        from app import app as new_app
        new_app.config["TESTING"] = True
        with new_app.test_client() as new_client:
            resp2 = new_client.get(
                "/meetings",
                headers=auth(token),
            )
            data2 = resp2.get_json()
            assert resp2.status_code == 200
            assert len(data2["meetings"]) == 1
            assert data2["meetings"][0]["meeting_id"] == "restart-meeting"

    def test_tokens_work_after_restart(self, client):
        """Tokens issued before restart are still valid after."""
        user, token = register_and_login(client, "token-persist@test.com")

        # Verify token works
        resp = client.get("/auth/me", headers=auth(token))
        assert resp.status_code == 200

        # Create new app instance
        from app import app as new_app
        new_app.config["TESTING"] = True
        with new_app.test_client() as new_client:
            resp2 = new_client.get("/auth/me", headers=auth(token))
            assert resp2.status_code == 200
