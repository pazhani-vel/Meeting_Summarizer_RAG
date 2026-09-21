"""
Core authentication primitives — no Flask routes.

Depends on:
  - bcrypt  (password hashing)
  - PyJWT   (token signing / verification)
  - config  (JWT_SECRET, JWT_ACCESS_TTL_MIN, JWT_REFRESH_TTL_DAYS)
  - models.db (MongoDB collections)

Design goals:
  - Passwords hashed with bcrypt, work factor ≥ 12.
  - Duplicate-email errors are typed (DuplicateEmailError).
  - authenticate() returns None for *both* "no such user" and "wrong
    password" and takes roughly the same wall-clock time either way
    so the endpoint can't be used to enumerate registered emails.
  - Two-token model: access (short) + refresh (long), both HS256.
  - Token blocklist for revocation with MongoDB TTL self-expiry.
"""

from __future__ import annotations

import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

import config
from models.db import get_db


# ── typed errors ──────────────────────────────────────────────────────

class DuplicateEmailError(Exception):
    """Raised when attempting to register an email that already exists."""


# ── password hashing ──────────────────────────────────────────────────

_BCRYPT_ROUNDS = 12


def hash_password(plain: str) -> str:
    """Hash *plain* with bcrypt (work factor 12, per-password salt)."""
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time check via bcrypt's own ``checkpw``."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── email helpers ─────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def _validate_email(email: str) -> None:
    if not _EMAIL_RE.match(email):
        raise ValueError(f"Invalid email address: {email}")


# ── user CRUD ─────────────────────────────────────────────────────────

_MIN_PASSWORD_LEN = 8


def create_user(email: str, password: str) -> dict[str, Any]:
    """
    Register a new user.

    Returns ``{"_id": ..., "email": ..., "created_at": ...}``.
    Raises ``DuplicateEmailError`` if the email is already taken.
    Raises ``ValueError`` for bad email format or short password.
    """
    email = _normalise_email(email)
    _validate_email(email)

    if len(password) < _MIN_PASSWORD_LEN:
        raise ValueError(
            f"Password must be at least {_MIN_PASSWORD_LEN} characters."
        )

    users = _users_col()

    # Duplicate check
    if users.find_one({"email": email}, {"_id": 1}):
        raise DuplicateEmailError(f"Email already registered: {email}")

    now = datetime.now(timezone.utc)
    doc = {
        "_id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "created_at": now,
    }
    users.insert_one(doc)

    return {"_id": doc["_id"], "email": doc["email"], "created_at": doc["created_at"]}


def authenticate(email: str, password: str) -> dict[str, Any] | None:
    """
    Verify credentials and return the user dict on success.

    Returns ``None`` for *both* "no such user" and "wrong password"
    with matching wall-clock time so an attacker cannot enumerate
    registered emails via timing.
    """
    email = _normalise_email(email)
    users = _users_col()

    user = users.find_one({"email": email})
    if user is None:
        # Dummy bcrypt hash so the timing is comparable
        _fake_hash(bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    return {"_id": user["_id"], "email": user["email"]}


# ── JWT tokens ────────────────────────────────────────────────────────

def issue_tokens(user_id: str) -> dict[str, str]:
    """
    Create an access + refresh token pair.

    Both are HS256-signed and contain ``sub`` (user id), ``jti``
    (uuid4), ``type`` ("access" | "refresh"), ``iat``, ``exp``.
    """
    now = datetime.now(timezone.utc)

    access_exp = now + timedelta(minutes=config.JWT_ACCESS_TTL_MIN)
    refresh_exp = now + timedelta(days=config.JWT_REFRESH_TTL_DAYS)

    access_payload = {
        "sub": user_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
        "iat": now,
        "exp": access_exp,
    }
    refresh_payload = {
        "sub": user_id,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
        "iat": now,
        "exp": refresh_exp,
    }

    return {
        "access_token": jwt.encode(access_payload, config.JWT_SECRET, algorithm="HS256"),
        "refresh_token": jwt.encode(refresh_payload, config.JWT_SECRET, algorithm="HS256"),
    }


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    """
    Verify signature, expiry, and token type.

    Raises ``jwt.InvalidTokenError`` (or a subclass) on any failure:
      - ``jwt.ExpiredSignatureError``  – token expired
      - ``jwt.InvalidTokenError``      – bad signature, wrong type, etc.

    Returns the decoded payload on success.
    """
    payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])

    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(
            f"Expected token type '{expected_type}', got '{payload.get('type')}'"
        )

    return payload


# ── token revocation ──────────────────────────────────────────────────

def revoke(jti: str, expires_at: datetime) -> None:
    """
    Insert *jti* into the ``token_blocklist`` collection.

    A MongoDB TTL index on ``expires_at`` (expireAfterSeconds=0)
    will automatically remove the document once the original token
    would have expired.
    """
    db = get_db()
    db.token_blocklist.insert_one({
        "jti": jti,
        "expires_at": expires_at,
    })


def is_revoked(jti: str) -> bool:
    """Return ``True`` if *jti* is in the blocklist."""
    db = get_db()
    return db.token_blocklist.find_one({"jti": jti}, {"_id": 1}) is not None


# ── private helpers ───────────────────────────────────────────────────

def _users_col():
    return get_db()["users"]


def _fake_hash(salt: bytes) -> None:
    """Compute and discard a bcrypt hash to burn comparable time."""
    bcrypt.hashpw(b"dummy-password-for-timing", salt)
