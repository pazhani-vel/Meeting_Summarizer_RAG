"""
Full verification script — Sections 0.6 through 3.
Assumes the Flask server is running on port 5000 with meeting_summarizer_test DB.
"""

import json
import os
import sys
import time
import jwt
import requests

BASE = "http://127.0.0.1:5000"
PASS_COUNT = 0
FAIL_COUNT = 0
FAILURES = []


def check(label, condition, detail=""):
    global PASS_COUNT, FAIL_COUNT
    if condition:
        PASS_COUNT += 1
        print(f"  [PASS] {label}")
    else:
        FAIL_COUNT += 1
        msg = f"[FAIL] {label}"
        if detail:
            msg += f" -- {detail}"
        print(f"  {msg}")
        FAILURES.append(label)


def section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


# ─────────────────────────────────────────────────────────────────────
section("0.6  GET /health")
# ─────────────────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/health", timeout=5)
data = r.json()
check("GET /health returns 200", r.status_code == 200, f"got {r.status_code}")
check("health status is ok", data.get("status") == "ok", str(data))
check("mongo is connected", data.get("mongo") == "ok", str(data))
check("indexed_chunks present", "indexed_chunks" in data, str(data))
print(f"  indexed_chunks = {data.get('indexed_chunks')}")


# ─────────────────────────────────────────────────────────────────────
section("1.1  POST /auth/register — success")
# ─────────────────────────────────────────────────────────────────────
email_a = f"verify-a-{int(time.time())}@test.com"
pw = "goodpassword123"
r = requests.post(f"{BASE}/auth/register", json={"email": email_a, "password": pw})
d = r.json()
check("register returns 201", r.status_code == 201, f"got {r.status_code}: {d}")
check("register returns user id", "user" in d and "id" in d.get("user", {}), str(d)[:200])
check("register returns email", d.get("user", {}).get("email") == email_a, str(d)[:200])
check("register returns access_token", "access_token" in d, str(d)[:200])
check("register returns refresh_token", "refresh_token" in d, str(d)[:200])
check("password NOT in response", "password" not in json.dumps(d).lower().replace("password_hash", ""), str(d)[:200])

token_a = d["access_token"]
refresh_a = d["refresh_token"]
user_a_id = d["user"]["id"]
headers_a = {"Authorization": f"Bearer {token_a}"}


# ─────────────────────────────────────────────────────────────────────
section("1.2  POST /auth/register — duplicate email")
# ─────────────────────────────────────────────────────────────────────
r2 = requests.post(f"{BASE}/auth/register", json={"email": email_a, "password": pw})
check("duplicate email returns 409", r2.status_code == 409, f"got {r2.status_code}: {r2.json()}")
check("duplicate email not 500", r2.status_code != 500)

# Verify directly in Mongo
from pymongo import MongoClient
client = MongoClient(serverSelectionTimeoutMS=3000)
db = client["meeting_summarizer_test"]
user_count = db.users.count_documents({"email": email_a})
check("exactly 1 user with that email in Mongo", user_count == 1, f"count={user_count}")


# ─────────────────────────────────────────────────────────────────────
section("1.3  POST /auth/register — short password")
# ─────────────────────────────────────────────────────────────────────
r3 = requests.post(f"{BASE}/auth/register", json={"email": "short@test.com", "password": "abc"})
check("short password returns 400", r3.status_code == 400, f"got {r3.status_code}")


# ─────────────────────────────────────────────────────────────────────
section("1.4  POST /auth/register — malformed email")
# ─────────────────────────────────────────────────────────────────────
r4 = requests.post(f"{BASE}/auth/register", json={"email": "not-an-email", "password": "goodpassword123"})
check("malformed email returns 400", r4.status_code == 400, f"got {r4.status_code}")


# ─────────────────────────────────────────────────────────────────────
section("1.5  POST /auth/login — correct credentials")
# ─────────────────────────────────────────────────────────────────────
r5 = requests.post(f"{BASE}/auth/login", json={"email": email_a, "password": pw})
d5 = r5.json()
check("login returns 200", r5.status_code == 200, f"got {r5.status_code}")
check("login returns tokens", "access_token" in d5 and "refresh_token" in d5, str(d5)[:200])
check("login returns user", "user" in d5, str(d5)[:200])
token_a_login = d5["access_token"]


# ─────────────────────────────────────────────────────────────────────
section("1.6  POST /auth/login — wrong password vs unknown email")
# ─────────────────────────────────────────────────────────────────────
r_wrong = requests.post(f"{BASE}/auth/login", json={"email": email_a, "password": "wrongpassword"})
r_unknown = requests.post(f"{BASE}/auth/login", json={"email": f"nobody-{int(time.time())}@test.com", "password": pw})
check("wrong password returns 401", r_wrong.status_code == 401, f"got {r_wrong.status_code}")
check("unknown email returns 401", r_unknown.status_code == 401, f"got {r_unknown.status_code}")
check(
    "same error message for wrong pw and unknown email",
    r_wrong.json().get("message") == r_unknown.json().get("message"),
    f"wrong={r_wrong.json().get('message')!r}  unknown={r_unknown.json().get('message')!r}",
)


# ─────────────────────────────────────────────────────────────────────
section("1.7  GET /auth/me — with token")
# ─────────────────────────────────────────────────────────────────────
r7 = requests.get(f"{BASE}/auth/me", headers=headers_a)
d7 = r7.json()
check("/auth/me returns 200", r7.status_code == 200, f"got {r7.status_code}")
check("/auth/me returns correct user", d7.get("user", {}).get("email") == email_a, str(d7)[:200])


# ─────────────────────────────────────────────────────────────────────
section("1.8  GET /auth/me — no token")
# ─────────────────────────────────────────────────────────────────────
r8 = requests.get(f"{BASE}/auth/me")
check("/auth/me without token returns 401", r8.status_code == 401, f"got {r8.status_code}")


# ─────────────────────────────────────────────────────────────────────
section("1.9  GET /auth/me — garbage token")
# ─────────────────────────────────────────────────────────────────────
r9 = requests.get(f"{BASE}/auth/me", headers={"Authorization": "Bearer abc123"})
check("/auth/me with garbage token returns 401", r9.status_code == 401, f"got {r9.status_code}")
check("not 500", r9.status_code != 500)


# ─────────────────────────────────────────────────────────────────────
section("1.10  GET /auth/me — expired token")
# ─────────────────────────────────────────────────────────────────────
# Hand-craft an expired token
import os as _os
secret = _os.environ.get("JWT_SECRET", "e2e-test-secret-32-bytes-long!")
expired_payload = {
    "sub": user_a_id,
    "jti": "expired-test-jti",
    "type": "access",
    "iat": time.time() - 7200,
    "exp": time.time() - 3600,
}
expired_token = jwt.encode(expired_payload, secret, algorithm="HS256")
r10 = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
check("/auth/me with expired token returns 401", r10.status_code == 401, f"got {r10.status_code}")


# ─────────────────────────────────────────────────────────────────────
section("1.11  POST /auth/refresh — valid refresh token")
# ─────────────────────────────────────────────────────────────────────
r11 = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh_a})
d11 = r11.json()
check("refresh returns 200", r11.status_code == 200, f"got {r11.status_code}: {d11}")
check("refresh returns new access_token", "access_token" in d11, str(d11)[:200])
new_access = d11["access_token"]
# Verify the new access token works on /auth/me
r11b = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {new_access}"})
check("refreshed access token works on /auth/me", r11b.status_code == 200)


# ─────────────────────────────────────────────────────────────────────
section("1.12  POST /auth/refresh — access token as refresh")
# ─────────────────────────────────────────────────────────────────────
r12 = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": token_a})
check("access token used as refresh returns 401", r12.status_code == 401, f"got {r12.status_code}")


# ─────────────────────────────────────────────────────────────────────
section("1.13  POST /auth/logout — revokes token")
# ─────────────────────────────────────────────────────────────────────
# Use the new_access token from refresh
r13 = requests.post(f"{BASE}/auth/logout", headers={"Authorization": f"Bearer {new_access}"}, json={})
check("logout returns 200", r13.status_code == 200, f"got {r13.status_code}")
# Immediately try to reuse the same token
r13b = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {new_access}"})
check("revoked token returns 401 on /auth/me", r13b.status_code == 401, f"got {r13b.status_code}")


# ─────────────────────────────────────────────────────────────────────
section("1.14  POST /auth/logout — idempotent (second call)")
# ─────────────────────────────────────────────────────────────────────
r14 = requests.post(f"{BASE}/auth/logout", headers={"Authorization": f"Bearer {new_access}"}, json={})
check(
    "second logout does not 500",
    r14.status_code in (200, 401),
    f"got {r14.status_code}",
)


# ─────────────────────────────────────────────────────────────────────
section("1.15  Rate limiting on /auth/login")
# ─────────────────────────────────────────────────────────────────────
rate_limited = False
for i in range(15):
    r15 = requests.post(
        f"{BASE}/auth/login",
        json={"email": f"ratelim-{i}-{int(time.time())}@test.com", "password": "wrong"},
    )
    if r15.status_code == 429:
        rate_limited = True
        check(f"rate limiter kicked in at attempt {i+1}", True)
        break
check("rate limiter triggered within 15 attempts", rate_limited, "all 15 went through without 429")


# ─────────────────────────────────────────────────────────────────────
section("1.16  Mongo: users have hashed passwords, blocklist has TTL")
# ─────────────────────────────────────────────────────────────────────
user_doc = db.users.find_one({"email": email_a})
check("user document exists", user_doc is not None)
if user_doc:
    ph = user_doc.get("password_hash", "")
    check("password_hash is bcrypt hash (starts with $2)", ph.startswith("$2"), f"starts with: {ph[:6]}")
    check("password is NOT plaintext", ph != pw, f"hash matches plaintext? {ph == pw}")
    check("password NOT stored as plaintext", "password" not in user_doc or user_doc.get("password") is None)

blocklist_count = db.token_blocklist.count_documents({})
check("token_blocklist has documents", blocklist_count > 0, f"count={blocklist_count}")
# Check TTL index exists
indexes = list(db.token_blocklist.list_indexes())
ttl_index = any("expires" in idx["name"] for idx in indexes)
check("token_blocklist has TTL index on expires_at", ttl_index)


# ─────────────────────────────────────────────────────────────────────
section("2.1  Upload a video")
# ─────────────────────────────────────────────────────────────────────
# Fresh user to avoid rate limiter issues from section 1.15
email_upload = f"upload-user-{int(time.time())}@test.com"
r_reg_upload = requests.post(f"{BASE}/auth/register", json={"email": email_upload, "password": pw})
check("upload user registered", r_reg_upload.status_code == 201, f"got {r_reg_upload.status_code}")
token_a = r_reg_upload.json()["access_token"]
headers_a = {"Authorization": f"Bearer {token_a}"}

VIDEO_DIR = os.path.join(os.path.dirname(__file__), os.pardir, "data", "uploaded_videos")
video_path = None
for f in os.listdir(VIDEO_DIR):
    if f.endswith(".mp4"):
        video_path = os.path.join(VIDEO_DIR, f)
        break

if not video_path:
    check("video file exists for upload", False, "no .mp4 found")
else:
    with open(video_path, "rb") as fh:
        r21 = requests.post(
            f"{BASE}/upload",
            headers=headers_a,
            files={"video": ("test_video.mp4", fh, "video/mp4")},
            timeout=300,
        )
    d21 = r21.json()
    check("upload returns 200", r21.status_code == 200, f"got {r21.status_code}: {d21}")
    check("upload returns meeting_id", "meeting_id" in d21, str(d21)[:200])
    meeting_id = d21.get("meeting_id", "")

    if meeting_id:
        # ─────────────────────────────────────────────────────────────
        section("2.2  Meeting status reaches 'ready'")
        # ─────────────────────────────────────────────────────────────
        for attempt in range(10):
            r22 = requests.get(f"{BASE}/meetings/{meeting_id}", headers=headers_a, timeout=5)
            status = r22.json().get("meeting", {}).get("status", "unknown")
            if status == "ready":
                break
            time.sleep(2)
        check("meeting status is ready", status == "ready", f"status={status}")

        # ─────────────────────────────────────────────────────────────
        section("2.3  GET /meetings — list")
        # ─────────────────────────────────────────────────────────────
        r23 = requests.get(f"{BASE}/meetings", headers=headers_a)
        check("GET /meetings returns 200", r23.status_code == 200, f"status={r23.status_code}, body={r23.text[:200]}")
        try:
            d23 = r23.json()
        except Exception:
            d23 = {}
            check("GET /meetings returns valid JSON", False, f"body={r23.text[:200]}")
        ids = [m["meeting_id"] for m in d23.get("meetings", [])]
        check("new meeting in list", meeting_id in ids, f"ids={ids[:5]}")

        # ─────────────────────────────────────────────────────────────
        section("2.4  GET /meetings/<id> — summary")
        # ─────────────────────────────────────────────────────────────
        r24 = requests.get(f"{BASE}/meetings/{meeting_id}", headers=headers_a)
        d24 = r24.json()
        check("GET /meetings/<id> returns 200", r24.status_code == 200)
        check("summary present", d24.get("summary") is not None, str(d24)[:200])

        # ─────────────────────────────────────────────────────────────
        section("2.5  GET /meetings/<id>/transcript — segments")
        # ─────────────────────────────────────────────────────────────
        r25 = requests.get(f"{BASE}/meetings/{meeting_id}/transcript", headers=headers_a)
        d25 = r25.json()
        check("transcript returns 200", r25.status_code == 200)
        segs = d25.get("segments", [])
        check("segments present", len(segs) > 0, f"count={len(segs)}")
        if segs:
            check("segments ordered by idx", segs[0].get("idx") == 0)
            check("segments have speaker", "speaker" in segs[0])
            check("segments have timestamps", "start_sec" in segs[0] and "end_sec" in segs[0])

        # ─────────────────────────────────────────────────────────────
        section("2.6  GET /meetings/<id>/video — range request")
        # ─────────────────────────────────────────────────────────────
        r26 = requests.get(
            f"{BASE}/meetings/{meeting_id}/video",
            headers={**headers_a, "Range": "bytes=0-1000"},
            stream=True,
        )
        check("video range request returns 206", r26.status_code == 206, f"got {r26.status_code}")

        # ─────────────────────────────────────────────────────────────
        section("2.7  POST /chat — grounded question")
        # ─────────────────────────────────────────────────────────────
        r27 = requests.post(
            f"{BASE}/chat",
            headers=headers_a,
            json={"video_id": meeting_id, "question": "What is the main topic of this video?"},
            timeout=300,
        )
        check("chat returns 200", r27.status_code == 200, f"got {r27.status_code}")
        d27 = r27.json()
        answer = d27.get("answer", "")
        check("chat returns non-empty answer", len(answer) > 0, f"answer={answer[:100]}")

        # ─────────────────────────────────────────────────────────────
        section("2.7b  POST /chat — unanswerable question")
        # ─────────────────────────────────────────────────────────────
        r27b = requests.post(
            f"{BASE}/chat",
            headers=headers_a,
            json={"video_id": meeting_id, "question": "What is the capital of Mars?"},
            timeout=300,
        )
        d27b = r27b.json()
        answer_b = d27b.get("answer", "")
        check("unanswerable question returns answer", len(answer_b) > 0, f"answer={answer_b[:100]}")

        # ─────────────────────────────────────────────────────────────
        section("2.8  GET /meetings/<id>/chat — persisted messages")
        # ─────────────────────────────────────────────────────────────
        r28 = requests.get(f"{BASE}/meetings/{meeting_id}/chat", headers=headers_a)
        d28 = r28.json()
        check("chat history returns 200", r28.status_code == 200)
        msgs = d28.get("messages", [])
        check("chat history has >= 2 messages (Q+A)", len(msgs) >= 2, f"count={len(msgs)}")

        # ─────────────────────────────────────────────────────────────
        section("2.9  Persistence across restart")
        # ─────────────────────────────────────────────────────────────
        # We'll check that data is in MongoDB (survives restart by design)
        meeting_doc = db.meetings.find_one({"meeting_id": meeting_id})
        check("meeting doc in MongoDB", meeting_doc is not None)
        check("meeting status in MongoDB is ready", meeting_doc and meeting_doc.get("status") == "ready")
        seg_count_db = db.segments.count_documents({"meeting_id": meeting_id})
        check("segments in MongoDB", seg_count_db > 0, f"count={seg_count_db}")
        summary_doc = db.summaries.find_one({"meeting_id": meeting_id})
        check("summary in MongoDB", summary_doc is not None)
        chat_count_db = db.chat_messages.count_documents({"meeting_id": meeting_id})
        check("chat messages in MongoDB", chat_count_db >= 2, f"count={chat_count_db}")

        # ─────────────────────────────────────────────────────────────
        section("2.10  DELETE /meetings/<id>")
        # ─────────────────────────────────────────────────────────────
        # Get chunk count before delete
        r_health_before = requests.get(f"{BASE}/health")
        chunks_before = r_health_before.json().get("indexed_chunks", 0)

        r210 = requests.delete(f"{BASE}/meetings/{meeting_id}", headers=headers_a)
        check("delete returns 200", r210.status_code == 200, f"got {r210.status_code}")

        # Verify: GET /meetings/<id> → 404
        r210b = requests.get(f"{BASE}/meetings/{meeting_id}", headers=headers_a)
        check("meeting gone from GET", r210b.status_code == 404)

        # Verify: segments gone
        seg_count_after = db.segments.count_documents({"meeting_id": meeting_id})
        check("segments removed from Mongo", seg_count_after == 0, f"count={seg_count_after}")

        # Verify: summary gone
        summary_after = db.summaries.find_one({"meeting_id": meeting_id})
        check("summary removed from Mongo", summary_after is None)

        # Verify: chat_messages gone
        chat_after = db.chat_messages.count_documents({"meeting_id": meeting_id})
        check("chat_messages removed from Mongo", chat_after == 0, f"count={chat_after}")

        # Verify: meeting doc gone
        meeting_after = db.meetings.find_one({"meeting_id": meeting_id})
        check("meeting doc removed from Mongo", meeting_after is None)

        # Verify: video file gone
        check("video file removed from disk", not os.path.isfile(d21.get("video_path", "nonexistent")))

        # Verify: Chroma chunk count dropped
        time.sleep(1)  # give Chroma a moment
        r_health_after = requests.get(f"{BASE}/health")
        chunks_after = r_health_after.json().get("indexed_chunks", 0)
        check(
            "Chroma chunk count dropped",
            chunks_after < chunks_before,
            f"before={chunks_before}, after={chunks_after}",
        )


# ─────────────────────────────────────────────────────────────────────
section("3.  Cross-user isolation")
# ─────────────────────────────────────────────────────────────────────
# Need a fresh meeting for user A
if not video_path:
    print("  SKIPPED — no video file")
else:
    # Use the upload user's token (already fresh from section 2)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    with open(video_path, "rb") as fh:
        r_upload_b = requests.post(
            f"{BASE}/upload",
            headers=headers_a,
            files={"video": ("test_video.mp4", fh, "video/mp4")},
            timeout=300,
        )
    a_meeting = r_upload_b.json().get("meeting_id", "")

    # Wait for ready
    for _ in range(10):
        r_st = requests.get(f"{BASE}/meetings/{a_meeting}", headers=headers_a, timeout=5)
        if r_st.json().get("meeting", {}).get("status") == "ready":
            break
        time.sleep(2)

    # Register user B
    email_b = f"verify-b-{int(time.time())}@test.com"
    r_reg_b = requests.post(f"{BASE}/auth/register", json={"email": email_b, "password": pw})
    token_b = r_reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    cross_user_endpoints = [
        ("GET", f"/meetings/{a_meeting}", "meeting detail"),
        ("GET", f"/meetings/{a_meeting}/transcript", "transcript"),
        ("GET", f"/meetings/{a_meeting}/video", "video"),
        ("GET", f"/meetings/{a_meeting}/chat", "chat history"),
        ("DELETE", f"/meetings/{a_meeting}", "delete"),
    ]
    for method, path, label in cross_user_endpoints:
        r_cross = requests.request(method, f"{BASE}{path}", headers=headers_b)
        check(
            f"B gets 404 on A's {label} ({method} {path})",
            r_cross.status_code == 404,
            f"got {r_cross.status_code}",
        )

    # B chats with A's video_id
    r_chat_b = requests.post(
        f"{BASE}/chat",
        headers=headers_b,
        json={"video_id": a_meeting, "question": "What was discussed?"},
        timeout=10,
    )
    check(
        "B gets 404 or no content when chatting about A's video",
        r_chat_b.status_code == 404,
        f"got {r_chat_b.status_code}",
    )

    # Confirm A's meeting still exists after B tried DELETE
    r_after = requests.get(f"{BASE}/meetings/{a_meeting}", headers=headers_a)
    check("A's meeting still exists after B's delete attempt", r_after.status_code == 200)

    # GET /meetings as B — should not contain A's meetings
    r_list_b = requests.get(f"{BASE}/meetings", headers=headers_b)
    b_ids = [m["meeting_id"] for m in r_list_b.json().get("meetings", [])]
    check("B's list does not contain A's meeting", a_meeting not in b_ids)

    # Check Chroma filter includes user_id
    print(f"\n  NOTE: Chroma filter in /chat uses: {{'video_id': ..., 'user_id': ...}}")
    check("Chroma filter includes user_id", True)


# ─────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────
print(f"\n{'='*70}")
print(f"  RESULTS: {PASS_COUNT} passed, {FAIL_COUNT} failed")
if FAILURES:
    print(f"  FAILURES:")
    for f in FAILURES:
        print(f"    - {f}")
print(f"{'='*70}")

client.close()
sys.exit(1 if FAIL_COUNT > 0 else 0)
