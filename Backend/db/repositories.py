"""
Plain-function repositories for MongoDB collections.

No ORM — just pymongo calls. Each function is stateless and takes
the collection (or db) it needs, keeping the data access layer
explicit and testable.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo import ASCENDING, DESCENDING

from db.mongo import get_db


# ── helpers ───────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _col(name: str):
    return get_db()[name]


# =====================================================================
# meetings
# =====================================================================

def create_meeting(
    meeting_id: str,
    user_id: str,
    filename: str,
    video_path: str,
) -> dict[str, Any]:
    """Insert a meeting with status *pending* and return the document."""
    doc = {
        "meeting_id": meeting_id,
        "user_id": user_id,
        "filename": filename,
        "video_path": video_path,
        "duration_sec": None,
        "language": None,
        "status": "pending",
        "error": None,
        "created_at": _now(),
        "completed_at": None,
    }
    _col("meetings").insert_one(doc)
    return doc


def update_meeting_status(
    meeting_id: str,
    status: str,
    *,
    error: str | None = None,
    duration_sec: float | None = None,
    language: str | None = None,
) -> None:
    """Patch status (and optionally extra fields) on the meeting row."""
    update: dict[str, Any] = {"status": status}
    if error is not None:
        update["error"] = error
    if duration_sec is not None:
        update["duration_sec"] = duration_sec
    if language is not None:
        update["language"] = language
    if status == "ready":
        update["completed_at"] = _now()
    _col("meetings").update_one(
        {"meeting_id": meeting_id}, {"$set": update}
    )


def get_meeting_by_id(meeting_id: str, user_id: str) -> dict | None:
    """Return a meeting only if owned by *user_id*."""
    return _col("meetings").find_one(
        {"meeting_id": meeting_id, "user_id": user_id}
    )


def list_user_meetings(
    user_id: str,
    *,
    limit: int = 50,
    skip: int = 0,
) -> list[dict]:
    """Return meetings for *user_id*, newest first."""
    cursor = (
        _col("meetings")
        .find(
            {"user_id": user_id},
            {
                "meeting_id": 1,
                "filename": 1,
                "status": 1,
                "duration_sec": 1,
                "created_at": 1,
            },
        )
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
    )
    return list(cursor)


def delete_meeting_docs(meeting_id: str) -> None:
    """Remove the meeting row itself."""
    _col("meetings").delete_one({"meeting_id": meeting_id})


# =====================================================================
# segments
# =====================================================================

def insert_segments(meeting_id: str, segments: list[dict]) -> None:
    """Bulk-insert diarised segments. Each dict has idx, start_sec, end_sec, speaker, text."""
    docs = [
        {
            "meeting_id": meeting_id,
            "idx": seg["idx"],
            "start_sec": seg["start_sec"],
            "end_sec": seg["end_sec"],
            "speaker": seg["speaker"],
            "text": seg["text"],
        }
        for seg in segments
    ]
    if docs:
        _col("segments").insert_many(docs)


def get_segments(meeting_id: str) -> list[dict]:
    """Return segments for a meeting, ordered by idx."""
    return list(
        _col("segments")
        .find({"meeting_id": meeting_id}, {"_id": 0})
        .sort("idx", ASCENDING)
    )


def delete_segments(meeting_id: str) -> None:
    """Remove all segments for a meeting."""
    _col("segments").delete_many({"meeting_id": meeting_id})


# =====================================================================
# summaries
# =====================================================================

def upsert_summary(
    meeting_id: str,
    summary: dict,
    key_topics: list[str],
    action_items: list[str],
    model: str,
) -> None:
    """Insert or replace the summary for a meeting."""
    doc = {
        "meeting_id": meeting_id,
        "summary": summary,
        "key_topics": key_topics,
        "action_items": action_items,
        "model": model,
        "created_at": _now(),
    }
    _col("summaries").replace_one(
        {"meeting_id": meeting_id}, doc, upsert=True
    )


def get_summary(meeting_id: str) -> dict | None:
    return _col("summaries").find_one(
        {"meeting_id": meeting_id}, {"_id": 0}
    )


def delete_summary(meeting_id: str) -> None:
    _col("summaries").delete_one({"meeting_id": meeting_id})


# =====================================================================
# chat_messages
# =====================================================================

def insert_chat_message(
    meeting_id: str,
    user_id: str,
    role: str,
    content: str,
    sources: list | None = None,
) -> dict:
    """Append a single chat message and return the inserted doc."""
    doc = {
        "meeting_id": meeting_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "sources": sources or [],
        "created_at": _now(),
    }
    _col("chat_messages").insert_one(doc)
    return doc


def get_chat_messages(meeting_id: str, user_id: str) -> list[dict]:
    """Return chat history for a meeting, oldest first."""
    return list(
        _col("chat_messages")
        .find({"meeting_id": meeting_id, "user_id": user_id}, {"_id": 0})
        .sort("created_at", ASCENDING)
    )


def delete_chat_messages(meeting_id: str) -> None:
    _col("chat_messages").delete_many({"meeting_id": meeting_id})
