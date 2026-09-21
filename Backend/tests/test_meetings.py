"""
Integration tests for the meetings persistence layer.

Covers:
  - /meetings list / detail / transcript / video / chat
  - DELETE cleanup across all stores
  - Chat message persistence
  - Ownership enforcement

Run from Backend/:
    cd Backend && python -m pytest tests/test_meetings.py -v

Requires a running MongoDB instance (uses a throwaway test database).
"""

from __future__ import annotations

import json
import os
import sys

import pytest

# Bootstrap
os.environ.setdefault("JWT_SECRET", "test-secret-for-meetings-tests")
os.environ.setdefault("MONGO_DB_NAME", "meeting_summarizer_test")

_backend_dir = os.path.join(os.path.dirname(__file__), os.pardir)
if _backend_dir not in sys.path:
    sys.path.insert(0, os.path.abspath(_backend_dir))


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def app():
    from app import app as flask_app
    flask_app.config["TESTING"] = True
    yield flask_app


@pytest.fixture()
def client(app):
    from models.db import get_db
    db = get_db()
    for col in ["users", "meetings", "segments", "summaries", "chat_messages", "token_blocklist"]:
        db[col].drop()
    with app.test_client() as c:
        yield c
    for col in ["users", "meetings", "segments", "summaries", "chat_messages", "token_blocklist"]:
        db[col].drop()


def _register(client, email, password="password123"):
    return client.post("/auth/register", json={"email": email, "password": password})


def _login(client, email, password="password123"):
    return client.post("/auth/login", json={"email": email, "password": password})


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _insert_fake_meeting(db, meeting_id, user_id, filename="test.mp4", status="ready", video_path="/fake/path.mp4"):
    db.meetings.insert_one({
        "meeting_id": meeting_id,
        "user_id": user_id,
        "filename": filename,
        "video_path": video_path,
        "duration_sec": 120.5,
        "language": "en",
        "status": status,
        "error": None,
        "created_at": "2025-06-01T10:00:00+00:00",
        "completed_at": "2025-06-01T10:02:00+00:00",
    })


def _insert_fake_segments(db, meeting_id, count=3):
    docs = [
        {
            "meeting_id": meeting_id,
            "idx": i,
            "start_sec": i * 10.0,
            "end_sec": (i + 1) * 10.0,
            "speaker": f"SPEAKER_{i % 2:02d}",
            "text": f"Segment {i} text content.",
        }
        for i in range(count)
    ]
    if docs:
        db.segments.insert_many(docs)


def _insert_fake_summary(db, meeting_id):
    db.summaries.replace_one(
        {"meeting_id": meeting_id},
        {
            "meeting_id": meeting_id,
            "summary": "This is a test summary of the meeting.",
            "key_topics": ["topic_a", "topic_b"],
            "action_items": ["do_thing_1"],
            "model": "test-model",
            "created_at": "2025-06-01T10:03:00+00:00",
        },
        upsert=True,
    )


# ── GET /meetings (list) ─────────────────────────────────────────────

class TestListMeetings:
    def test_empty_list_for_new_user(self, client):
        _register(client, "empty@test.com")
        login = _login(client, "empty@test.com").get_json()
        token = login["access_token"]

        resp = client.get("/meetings", headers=_auth(token))
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["meetings"] == []

    def test_list_returns_meetings_with_summary_preview(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "list@test.com")
        login = _login(client, "list@test.com").get_json()
        user_id = login["user"]["id"]
        token = login["access_token"]

        _insert_fake_meeting(db, "m1", user_id, "meeting1.mp4")
        _insert_fake_summary(db, "m1")

        resp = client.get("/meetings", headers=_auth(token))
        data = resp.get_json()
        assert resp.status_code == 200
        assert len(data["meetings"]) == 1
        m = data["meetings"][0]
        assert m["meeting_id"] == "m1"
        assert m["filename"] == "meeting1.mp4"
        assert m["status"] == "ready"
        assert m["duration_sec"] == 120.5
        assert "summary_preview" in m
        assert "key_topics" in m

    def test_list_limit_and_skip(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "pag@test.com")
        login = _login(client, "pag@test.com").get_json()
        user_id = login["user"]["id"]
        token = login["access_token"]

        for i in range(5):
            _insert_fake_meeting(db, f"pag-{i}", user_id, f"v{i}.mp4")

        resp = client.get("/meetings?limit=2", headers=_auth(token))
        data = resp.get_json()
        assert len(data["meetings"]) == 2

        resp = client.get("/meetings?limit=2&skip=3", headers=_auth(token))
        data = resp.get_json()
        assert len(data["meetings"]) == 2

    def test_user_b_sees_empty_list(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "owner2@test.com")
        _register(client, "other2@test.com")

        login_a = _login(client, "owner2@test.com").get_json()
        login_b = _login(client, "other2@test.com").get_json()

        _insert_fake_meeting(db, "owned-by-a", login_a["user"]["id"])

        resp = client.get("/meetings", headers=_auth(login_b["access_token"]))
        data = resp.get_json()
        assert data["meetings"] == []


# ── GET /meetings/<id> ───────────────────────────────────────────────

class TestGetMeetingDetail:
    def test_returns_metadata_and_summary(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "detail@test.com")
        login = _login(client, "detail@test.com").get_json()
        user_id = login["user"]["id"]
        token = login["access_token"]

        _insert_fake_meeting(db, "det1", user_id)
        _insert_fake_summary(db, "det1")

        resp = client.get("/meetings/det1", headers=_auth(token))
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["meeting"]["meeting_id"] == "det1"
        assert data["summary"]["summary"] == "This is a test summary of the meeting."

    def test_404_for_other_users_meeting(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "own3@test.com")
        _register(client, "oth3@test.com")

        login_a = _login(client, "own3@test.com").get_json()
        login_b = _login(client, "oth3@test.com").get_json()

        _insert_fake_meeting(db, "owned-det", login_a["user"]["id"])

        resp = client.get("/meetings/owned-det", headers=_auth(login_b["access_token"]))
        assert resp.status_code == 404


# ── GET /meetings/<id>/transcript ────────────────────────────────────

class TestGetTranscript:
    def test_returns_segments_ordered_by_idx(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "trans@test.com")
        login = _login(client, "trans@test.com").get_json()
        user_id = login["user"]["id"]
        token = login["access_token"]

        _insert_fake_meeting(db, "tr1", user_id)
        _insert_fake_segments(db, "tr1", count=4)

        resp = client.get("/meetings/tr1/transcript", headers=_auth(token))
        data = resp.get_json()
        assert resp.status_code == 200
        segs = data["segments"]
        assert len(segs) == 4
        assert [s["idx"] for s in segs] == [0, 1, 2, 3]

    def test_404_for_unowned(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "transown@test.com")
        _register(client, "transb@test.com")

        login_a = _login(client, "transown@test.com").get_json()
        login_b = _login(client, "transb@test.com").get_json()

        _insert_fake_meeting(db, "tr-own", login_a["user"]["id"])

        resp = client.get("/meetings/tr-own/transcript", headers=_auth(login_b["access_token"]))
        assert resp.status_code == 404


# ── GET /meetings/<id>/video ─────────────────────────────────────────

class TestGetVideo:
    def test_404_when_file_missing(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "vid@test.com")
        login = _login(client, "vid@test.com").get_json()
        user_id = login["user"]["id"]

        _insert_fake_meeting(db, "vid1", user_id, video_path="/nonexistent/file.mp4")

        resp = client.get("/meetings/vid1/video", headers=_auth(login["access_token"]))
        assert resp.status_code == 404

    def test_404_for_unowned(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "vidown@test.com")
        _register(client, "vidb@test.com")

        login_a = _login(client, "vidown@test.com").get_json()
        login_b = _login(client, "vidb@test.com").get_json()

        _insert_fake_meeting(db, "vid-own", login_a["user"]["id"])

        resp = client.get("/meetings/vid-own/video", headers=_auth(login_b["access_token"]))
        assert resp.status_code == 404


# ── GET /meetings/<id>/chat ──────────────────────────────────────────

class TestGetChat:
    def test_returns_chat_messages(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "chatget@test.com")
        login = _login(client, "chatget@test.com").get_json()
        user_id = login["user"]["id"]
        token = login["access_token"]

        _insert_fake_meeting(db, "cg1", user_id)

        db.chat_messages.insert_one({
            "meeting_id": "cg1",
            "user_id": user_id,
            "role": "user",
            "content": "What was discussed?",
            "sources": [],
            "created_at": "2025-06-01T11:00:00+00:00",
        })
        db.chat_messages.insert_one({
            "meeting_id": "cg1",
            "user_id": user_id,
            "role": "assistant",
            "content": "The team discussed quarterly targets.",
            "sources": [{"chunk_index": 0}],
            "created_at": "2025-06-01T11:00:01+00:00",
        })

        resp = client.get("/meetings/cg1/chat", headers=_auth(token))
        data = resp.get_json()
        assert resp.status_code == 200
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"


# ── DELETE /meetings/<id> ────────────────────────────────────────────

class TestDeleteMeeting:
    def test_removes_meeting_and_related_docs(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "del@test.com")
        login = _login(client, "del@test.com").get_json()
        user_id = login["user"]["id"]
        token = login["access_token"]

        _insert_fake_meeting(db, "del1", user_id, status="ready")
        _insert_fake_segments(db, "del1", count=3)
        _insert_fake_summary(db, "del1")
        db.chat_messages.insert_one({
            "meeting_id": "del1", "user_id": user_id,
            "role": "user", "content": "hi", "sources": [],
            "created_at": "2025-06-01T12:00:00+00:00",
        })

        # Verify docs exist
        assert db.meetings.find_one({"meeting_id": "del1"}) is not None
        assert db.segments.count_documents({"meeting_id": "del1"}) == 3
        assert db.summaries.find_one({"meeting_id": "del1"}) is not None
        assert db.chat_messages.count_documents({"meeting_id": "del1"}) == 1

        resp = client.delete("/meetings/del1", headers=_auth(token))
        assert resp.status_code == 200

        # Verify all docs removed
        assert db.meetings.find_one({"meeting_id": "del1"}) is None
        assert db.segments.count_documents({"meeting_id": "del1"}) == 0
        assert db.summaries.find_one({"meeting_id": "del1"}) is None
        assert db.chat_messages.count_documents({"meeting_id": "del1"}) == 0

    def test_404_for_unowned(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "delown@test.com")
        _register(client, "delb@test.com")

        login_a = _login(client, "delown@test.com").get_json()
        login_b = _login(client, "delb@test.com").get_json()

        _insert_fake_meeting(db, "del-own", login_a["user"]["id"])

        resp = client.delete("/meetings/del-own", headers=_auth(login_b["access_token"]))
        assert resp.status_code == 404

        # Verify it still exists
        assert db.meetings.find_one({"meeting_id": "del-own"}) is not None


# ── Chat persistence ─────────────────────────────────────────────────

class TestChatPersistence:
    def test_chat_messages_stored_in_db(self, client):
        from models.db import get_db
        db = get_db()

        _register(client, "chatpersist@test.com")
        login = _login(client, "chatpersist@test.com").get_json()
        user_id = login["user"]["id"]

        _insert_fake_meeting(db, "cp1", user_id)

        # The /chat endpoint tries to call the LLM and retriever which
        # won't work in a unit test, so we just verify the insert function
        from db.repositories import insert_chat_message
        insert_chat_message("cp1", user_id, "user", "Hello?", [])
        insert_chat_message("cp1", user_id, "assistant", "Hi there!", [{"chunk_index": 0}])

        from db.repositories import get_chat_messages
        msgs = get_chat_messages("cp1", user_id)
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert msgs[0]["content"] == "Hello?"
        assert msgs[1]["role"] == "assistant"
        assert msgs[1]["content"] == "Hi there!"
