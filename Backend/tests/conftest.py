"""
Shared test fixtures for all backend tests.

Every test run uses a separate test database (meeting_summarizer_test).
Collections are dropped before each test to guarantee isolation.
"""

import os
import sys
import tempfile

import pytest

# Bootstrap before any project import
os.environ.setdefault("JWT_SECRET", "test-secret-conftest-key-32bytes!")
os.environ.setdefault("MONGO_DB_NAME", "meeting_summarizer_test")
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")

_backend_dir = os.path.join(os.path.dirname(__file__), os.pardir)
if _backend_dir not in sys.path:
    sys.path.insert(0, os.path.abspath(_backend_dir))

# All collections that tests may touch
ALL_COLLECTIONS = [
    "users",
    "meetings",
    "segments",
    "summaries",
    "chat_messages",
    "token_blocklist",
]


@pytest.fixture(scope="module")
def app():
    """Module-scoped Flask app — one per test module."""
    from app import app as flask_app

    flask_app.config["TESTING"] = True
    flask_app.config["SERVER_NAME"] = "localhost"
    yield flask_app


@pytest.fixture(autouse=True)
def _clean_db(app):
    """Drop every test collection before and after each test."""
    from models.db import get_db

    db = get_db()
    for col in ALL_COLLECTIONS:
        db[col].drop()
    yield
    for col in ALL_COLLECTIONS:
        db[col].drop()


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset the in-memory rate limiter before each test.

    flask-limiter's storage is process-wide and keyed by remote address,
    so without this reset the /auth/register and /auth/login 10/minute
    limits are shared across every test client request. Once any test
    (e.g. TestRateLimit) exhausts the budget, all later logins in the
    same process get 429s and fail.
    """
    from limiter import limiter

    limiter.reset()
    yield


@pytest.fixture()
def client(app):
    """Flask test client."""
    with app.test_client() as c:
        yield c


# ── Helpers ───────────────────────────────────────────────────────────


def register(client, email, password="password123"):
    """Register and return the parsed JSON response."""
    resp = client.post("/auth/register", json={"email": email, "password": password})
    return resp.get_json(), resp.status_code


def login(client, email, password="password123"):
    """Login and return the parsed JSON response."""
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.get_json(), resp.status_code


def auth(token):
    """Return Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}


def register_and_login(client, email, password="password123"):
    """Register, login, return (user_data, access_token)."""
    register(client, email, password)
    data, _ = login(client, email, password)
    return data["user"], data["access_token"]


def insert_fake_meeting(db, meeting_id, user_id, filename="test.mp4",
                         status="ready", video_path=None):
    """Insert a meeting document directly into MongoDB."""
    doc = {
        "meeting_id": meeting_id,
        "user_id": user_id,
        "filename": filename,
        "video_path": video_path or f"/fake/path/{meeting_id}_{filename}",
        "duration_sec": 120.5,
        "language": "en",
        "status": status,
        "error": None,
        "created_at": "2025-06-01T10:00:00+00:00",
        "completed_at": "2025-06-01T10:02:00+00:00",
    }
    db.meetings.insert_one(doc)
    return doc


def insert_fake_segments(db, meeting_id, count=3):
    """Insert diarised segments directly."""
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


def insert_fake_summary(db, meeting_id):
    """Insert a summary document directly."""
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
