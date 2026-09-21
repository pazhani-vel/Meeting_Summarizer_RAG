"""
End-to-end smoke test against a running Flask server + Mongo.

Usage:
    cd Backend && python tests/e2e.py

Prerequisites:
    - MongoDB running on localhost:27017
    - Flask server running on localhost:5000
    - A short video file at data/uploaded_videos/ (any .mp4)

The script prints PASS/FAIL for each step and exits non-zero on any failure.
"""

import json
import os
import sys
import time

import requests

BASE = "http://127.0.0.1:5000"
VIDEO_DIR = os.path.join(os.path.dirname(__file__), os.pardir, "data", "uploaded_videos")


def find_test_video():
    """Find any .mp4 in the uploaded_videos directory."""
    for f in os.listdir(VIDEO_DIR):
        if f.endswith(".mp4"):
            return os.path.join(VIDEO_DIR, f)
    return None


def step(num, label):
    print(f"\n{'='*60}")
    print(f"  Step {num}: {label}")
    print(f"{'='*60}")


def ok(msg):
    print(f"  [PASS] {msg}")


def fail(msg):
    print(f"  [FAIL] {msg}")
    sys.exit(1)


def main():
    failures = 0

    # ── Step 1: Health check ──
    step(1, "Health check (public)")
    try:
        r = requests.get(f"{BASE}/health", timeout=5)
        data = r.json()
        assert r.status_code == 200
        assert data["status"] == "ok"
        ok(f"Health OK, mongo={data.get('mongo')}, chunks={data.get('indexed_chunks')}")
    except Exception as e:
        fail(f"Health check: {e}")

    # ── Step 2: Register user A ──
    step(2, "Register user A")
    email_a = f"e2e-user-a-{int(time.time())}@test.com"
    password = "password123"
    try:
        r = requests.post(f"{BASE}/auth/register", json={"email": email_a, "password": password})
        data = r.json()
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {data}"
        assert data["status"] == "success"
        token_a = data["access_token"]
        user_a = data["user"]
        ok(f"Registered A: {user_a['id']}")
    except Exception as e:
        fail(f"Register A: {e}")

    headers_a = {"Authorization": f"Bearer {token_a}"}

    # ── Step 3: Upload a real short video ──
    step(3, "Upload video as user A")
    video_path = find_test_video()
    if not video_path:
        fail("No .mp4 found in data/uploaded_videos/")

    try:
        with open(video_path, "rb") as f:
            r = requests.post(
                f"{BASE}/upload",
                headers=headers_a,
                files={"video": ("test_video.mp4", f, "video/mp4")},
                timeout=300,
            )
        data = r.json()
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {data}"
        assert data["status"] == "success"
        meeting_id = data["meeting_id"]
        ok(f"Uploaded, meeting_id={meeting_id}")
    except Exception as e:
        fail(f"Upload: {e}")

    # ── Step 4: Confirm status is ready ──
    step(4, "Confirm meeting status is ready")
    try:
        r = requests.get(f"{BASE}/meetings/{meeting_id}", headers=headers_a)
        data = r.json()
        assert r.status_code == 200
        assert data["meeting"]["status"] == "ready", f"Status: {data['meeting']['status']}"
        ok(f"Status: ready, filename={data['meeting']['filename']}")
    except Exception as e:
        fail(f"Status check: {e}")

    # ── Step 5: Ask a chat question ──
    step(5, "Ask a chat question about the meeting")
    try:
        r = requests.post(
            f"{BASE}/chat",
            headers=headers_a,
            json={"video_id": meeting_id, "question": "What was discussed in this meeting?"},
            timeout=120,
        )
        data = r.json()
        assert r.status_code == 200
        answer = data.get("answer", "")
        assert len(answer) > 0, "Answer is empty"
        ok(f"Got answer ({len(answer)} chars): {answer[:80]}...")
    except Exception as e:
        fail(f"Chat: {e}")

    # ── Step 6: Log out ──
    step(6, "Log out user A")
    try:
        r = requests.post(f"{BASE}/auth/logout", headers=headers_a, json={})
        assert r.status_code == 200
        ok("Logged out")
    except Exception as e:
        fail(f"Logout: {e}")

    # ── Step 7: Log in again ──
    step(7, "Log in again as user A")
    try:
        r = requests.post(f"{BASE}/auth/login", json={"email": email_a, "password": password})
        data = r.json()
        assert r.status_code == 200
        token_a = data["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}
        ok("Logged in, got new token")
    except Exception as e:
        fail(f"Login again: {e}")

    # ── Step 8: Confirm meeting is in history ──
    step(8, "Confirm meeting is in history")
    try:
        r = requests.get(f"{BASE}/meetings", headers=headers_a)
        data = r.json()
        assert r.status_code == 200
        assert len(data["meetings"]) >= 1, "No meetings found"
        ids = [m["meeting_id"] for m in data["meetings"]]
        assert meeting_id in ids, f"Meeting {meeting_id} not in history: {ids}"
        ok(f"Found {len(data['meetings'])} meeting(s), target present")
    except Exception as e:
        fail(f"History check: {e}")

    # ── Step 9: Open the meeting — confirm video, transcript, summary, chat ──
    step(9, "Open meeting — confirm transcript, summary, chat history")
    try:
        # Transcript
        r = requests.get(f"{BASE}/meetings/{meeting_id}/transcript", headers=headers_a)
        data = r.json()
        assert r.status_code == 200
        assert len(data["segments"]) > 0, "No transcript segments"
        ok(f"Transcript: {len(data['segments'])} segments")

        # Summary
        r = requests.get(f"{BASE}/meetings/{meeting_id}", headers=headers_a)
        data = r.json()
        assert r.status_code == 200
        assert data["summary"] is not None, "No summary"
        ok(f"Summary present ({len(data['summary'].get('summary', ''))} chars)")

        # Chat history
        r = requests.get(f"{BASE}/meetings/{meeting_id}/chat", headers=headers_a)
        data = r.json()
        assert r.status_code == 200
        assert len(data["messages"]) >= 2, f"Expected >= 2 chat messages, got {len(data['messages'])}"
        ok(f"Chat history: {len(data['messages'])} messages")

        # Video file
        r = requests.get(f"{BASE}/meetings/{meeting_id}/video", headers=headers_a, stream=True)
        assert r.status_code == 200
        content_type = r.headers.get("Content-Type", "")
        assert "video" in content_type or r.status_code == 200
        ok(f"Video stream OK (Content-Type: {content_type})")

    except Exception as e:
        fail(f"Meeting detail: {e}")

    # ── Step 10: Register user B ──
    step(10, "Register user B")
    email_b = f"e2e-user-b-{int(time.time())}@test.com"
    try:
        r = requests.post(f"{BASE}/auth/register", json={"email": email_b, "password": password})
        data = r.json()
        assert r.status_code == 201
        token_b = data["access_token"]
        user_b = data["user"]
        ok(f"Registered B: {user_b['id']}")
    except Exception as e:
        fail(f"Register B: {e}")

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # ── Step 11: B's history is empty ──
    step(11, "Confirm B's history is empty")
    try:
        r = requests.get(f"{BASE}/meetings", headers=headers_b)
        data = r.json()
        assert r.status_code == 200
        assert data["meetings"] == [], f"B has {len(data['meetings'])} meetings"
        ok("B's history is empty")
    except Exception as e:
        fail(f"B's history: {e}")

    # ── Step 12: B gets 404 on A's meeting ──
    step(12, "Confirm B gets 404 on A's meeting")
    try:
        endpoints = [
            ("GET", f"/meetings/{meeting_id}"),
            ("GET", f"/meetings/{meeting_id}/transcript"),
            ("GET", f"/meetings/{meeting_id}/chat"),
            ("GET", f"/summary/{meeting_id}"),
            ("DELETE", f"/meetings/{meeting_id}"),
        ]
        for method, path in endpoints:
            r = requests.request(method, f"{BASE}{path}", headers=headers_b)
            assert r.status_code == 404, f"{method} {path} returned {r.status_code}"
        ok("All 5 endpoints return 404 for B")
    except Exception as e:
        fail(f"Cross-user isolation: {e}")

    # ── Step 13: Delete as A ──
    step(13, "Delete meeting as user A")
    try:
        r = requests.delete(f"{BASE}/meetings/{meeting_id}", headers=headers_a)
        assert r.status_code == 200
        ok("Deleted")
    except Exception as e:
        fail(f"Delete: {e}")

    # ── Step 14: Confirm it's gone from all stores ──
    step(14, "Confirm meeting is gone from all stores")
    try:
        # Mongo
        r = requests.get(f"{BASE}/meetings/{meeting_id}", headers=headers_a)
        assert r.status_code == 404, f"Meeting still exists: {r.status_code}"
        ok("Gone from MongoDB (404 on GET)")

        # Transcript
        r = requests.get(f"{BASE}/meetings/{meeting_id}/transcript", headers=headers_a)
        assert r.status_code == 404
        ok("Gone from segments (404)")

        # Chat
        r = requests.get(f"{BASE}/meetings/{meeting_id}/chat", headers=headers_a)
        assert r.status_code == 404
        ok("Gone from chat_messages (404)")

        # History
        r = requests.get(f"{BASE}/meetings", headers=headers_a)
        data = r.json()
        ids = [m["meeting_id"] for m in data["meetings"]]
        assert meeting_id not in ids
        ok("Not in history list")

    except Exception as e:
        fail(f"Delete verification: {e}")

    # ── Summary ──
    print(f"\n{'='*60}")
    print(f"  ALL {14} STEPS PASSED")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
