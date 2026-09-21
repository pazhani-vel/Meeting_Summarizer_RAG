"""
MongoDB index definitions.

Call ensure_indexes() once at application startup.
Indexes are idempotent — safe to call repeatedly.
"""

from pymongo import ASCENDING, DESCENDING
from .mongo import get_db


def ensure_indexes():
    """Create all required indexes. Safe to call on every startup."""
    db = get_db()

    # ── users ──
    db.users.create_index(
        [("email", ASCENDING)],
        unique=True,
        name="ux_users_email",
    )

    # ── meetings ──
    db.meetings.create_index(
        [("meeting_id", ASCENDING)],
        unique=True,
        name="ux_meetings_meeting_id",
    )
    db.meetings.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        name="ix_meetings_user_created",
    )

    # ── segments ──
    db.segments.create_index(
        [("meeting_id", ASCENDING), ("idx", ASCENDING)],
        name="ix_segments_meeting_idx",
    )

    # ── summaries ──
    db.summaries.create_index(
        [("meeting_id", ASCENDING)],
        unique=True,
        name="ux_summaries_meeting_id",
    )

    # ── chat_messages ──
    db.chat_messages.create_index(
        [("meeting_id", ASCENDING), ("created_at", ASCENDING)],
        name="ix_chat_messages_meeting_created",
    )

    # ── token_blocklist ──
    db.token_blocklist.create_index(
        [("jti", ASCENDING)],
        unique=True,
        name="ux_token_blocklist_jti",
    )
    db.token_blocklist.create_index(
        "expires_at",
        expireAfterSeconds=0,
        name="ix_token_blocklist_expires",
    )
