"""
Unit tests for services/auth_service.py

Run from Backend/:
    cd Backend && python -m pytest tests/test_auth_service.py -v

Requires:
    - JWT_SECRET set in the environment (done in conftest via monkeypatch)
    - No live MongoDB needed — collections are mocked.
"""

from __future__ import annotations

import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import bcrypt
import jwt
import pytest

# ── Bootstrap: ensure config can import before anything else ──────────
# config.py raises RuntimeError if JWT_SECRET is missing, so we set it
# before any project module is imported.
os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-only")

# Make Backend/ importable as a package
_backend_dir = os.path.join(os.path.dirname(__file__), os.pardir)
if _backend_dir not in sys.path:
    sys.path.insert(0, os.path.abspath(_backend_dir))

from services.auth_service import (  # noqa: E402
    DuplicateEmailError,
    authenticate,
    create_user,
    decode_token,
    hash_password,
    issue_tokens,
    is_revoked,
    revoke,
    verify_password,
)


# ── Helpers ───────────────────────────────────────────────────────────

def _fake_users_collection():
    """Return a MagicMock that behaves like a pymongo users collection."""
    return MagicMock()


def _fake_db():
    """Return a MagicMock that behaves like a pymongo database."""
    db = MagicMock()
    db.__getitem__ = lambda self, name: MagicMock()  # col access
    return db


# ── Password hashing tests ────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        plain = "my-s3cret-password"
        hashed = hash_password(plain)
        assert hashed != plain
        assert isinstance(hashed, str)

    def test_same_password_produces_different_hashes(self):
        plain = "same-password-123"
        h1 = hash_password(plain)
        h2 = hash_password(plain)
        # bcrypt generates a random salt each time
        assert h1 != h2

    def test_verify_succeeds_on_correct_password(self):
        plain = "correct-password"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_fails_on_wrong_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_verify_fails_on_empty_password(self):
        hashed = hash_password("something")
        assert verify_password("", hashed) is False

    def test_bcrypt_rounds_at_least_12(self):
        """The work factor should be ≥ 12 (encoded in the hash header)."""
        hashed = hash_password("test")
        # bcrypt hashes look like $2b$12$...
        parts = hashed.split("$")
        rounds = int(parts[2])
        assert rounds >= 12


# ── create_user tests ────────────────────────────────────────────────

class TestCreateUser:
    @patch("services.auth_service._users_col")
    def test_normalises_email_to_lowercase(self, mock_col):
        col = MagicMock()
        col.find_one.return_value = None  # no duplicate
        mock_col.return_value = col

        result = create_user("  Alice@Example.COM  ", "password123")
        assert result["email"] == "alice@example.com"

    @patch("services.auth_service._users_col")
    def test_valid_user_returns_expected_keys(self, mock_col):
        col = MagicMock()
        col.find_one.return_value = None
        mock_col.return_value = col

        result = create_user("bob@test.com", "password123")
        assert "_id" in result
        assert result["email"] == "bob@test.com"
        assert "created_at" in result
        # insert_one was called
        col.insert_one.assert_called_once()

    @patch("services.auth_service._users_col")
    def test_duplicate_email_raises(self, mock_col):
        col = MagicMock()
        col.find_one.return_value = {"_id": "existing-id", "email": "taken@test.com"}
        mock_col.return_value = col

        with pytest.raises(DuplicateEmailError, match="already registered"):
            create_user("taken@test.com", "password123")

    def test_short_password_raises(self):
        with pytest.raises(ValueError, match="at least 8 characters"):
            create_user("short@test.com", "abc")

    def test_invalid_email_raises(self):
        with pytest.raises(ValueError, match="Invalid email"):
            create_user("not-an-email", "password123")

    @patch("services.auth_service._users_col")
    def test_stores_hash_not_plaintext(self, mock_col):
        col = MagicMock()
        col.find_one.return_value = None
        mock_col.return_value = col

        create_user("store@test.com", "my-plaintext-pw")
        inserted_doc = col.insert_one.call_args[0][0]
        assert inserted_doc["password_hash"] != "my-plaintext-pw"
        assert inserted_doc["password_hash"].startswith("$2b$")


# ── authenticate tests ───────────────────────────────────────────────

class TestAuthenticate:
    @patch("services.auth_service._users_col")
    def test_returns_user_on_valid_credentials(self, mock_col):
        col = MagicMock()
        hashed = hash_password("good-password")
        col.find_one.return_value = {
            "_id": "user-123",
            "email": "valid@test.com",
            "password_hash": hashed,
        }
        mock_col.return_value = col

        result = authenticate("valid@test.com", "good-password")
        assert result is not None
        assert result["_id"] == "user-123"
        assert result["email"] == "valid@test.com"

    @patch("services.auth_service._users_col")
    def test_returns_none_for_wrong_password(self, mock_col):
        col = MagicMock()
        hashed = hash_password("correct-password")
        col.find_one.return_value = {
            "_id": "user-456",
            "email": "wrong@test.com",
            "password_hash": hashed,
        }
        mock_col.return_value = col

        result = authenticate("wrong@test.com", "not-the-right-one")
        assert result is None

    @patch("services.auth_service._users_col")
    def test_returns_none_for_nonexistent_user(self, mock_col):
        col = MagicMock()
        col.find_one.return_value = None
        mock_col.return_value = col

        result = authenticate("nobody@test.com", "any-password")
        assert result is None

    @patch("services.auth_service._users_col")
    def test_wrong_password_has_similar_timing(self, mock_col):
        """
        Both "no such user" and "wrong password" should burn a
        comparable amount of bcrypt time so an attacker cannot
        enumerate emails via timing side-channel.
        """
        hashed = hash_password("real-password")

        # Case 1: user exists, wrong password
        col = MagicMock()
        col.find_one.return_value = {
            "_id": "u1",
            "email": "exists@test.com",
            "password_hash": hashed,
        }
        mock_col.return_value = col

        t0 = time.monotonic()
        authenticate("exists@test.com", "wrong-password")
        t1 = time.monotonic()

        # Case 2: user does not exist
        col.find_one.return_value = None

        t2 = time.monotonic()
        authenticate("nobody@test.com", "any-password")
        t3 = time.monotonic()

        existing_time = t1 - t0
        missing_time = t3 - t2
        # Allow a generous 50% tolerance — bcrypt is noisy,
        # but both should be in the same order of magnitude.
        assert missing_time > existing_time * 0.4
        assert missing_time < existing_time * 2.5

    def test_normalises_email_before_lookup(self):
        """Even if the DB call is mocked, the email should be lowercased."""
        with patch("services.auth_service._users_col") as mock_col:
            col = MagicMock()
            col.find_one.return_value = None
            mock_col.return_value = col

            authenticate("  User@Test.COM  ", "password1234")

            # The collection's find_one should have been called with
            # the normalised email.
            col.find_one.assert_called_once()
            called_email = col.find_one.call_args[0][0]["email"]
            assert called_email == "user@test.com"


# ── JWT token tests ──────────────────────────────────────────────────

class TestIssueTokens:
    def test_returns_access_and_refresh(self):
        tokens = issue_tokens("user-abc")
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["access_token"] != tokens["refresh_token"]

    def test_access_token_decodes_with_correct_type(self):
        tokens = issue_tokens("user-abc")
        payload = decode_token(tokens["access_token"], expected_type="access")
        assert payload["sub"] == "user-abc"
        assert payload["type"] == "access"
        assert "jti" in payload
        assert "iat" in payload
        assert "exp" in payload

    def test_refresh_token_decodes_with_correct_type(self):
        tokens = issue_tokens("user-abc")
        payload = decode_token(tokens["refresh_token"], expected_type="refresh")
        assert payload["sub"] == "user-abc"
        assert payload["type"] == "refresh"

    def test_different_jtis_for_access_and_refresh(self):
        tokens = issue_tokens("user-abc")
        access_payload = decode_token(tokens["access_token"], expected_type="access")
        refresh_payload = decode_token(tokens["refresh_token"], expected_type="refresh")
        assert access_payload["jti"] != refresh_payload["jti"]


class TestDecodeToken:
    def test_rejects_tampered_token(self):
        tokens = issue_tokens("user-xyz")
        token = tokens["access_token"]
        # Flip a character in the middle
        tampered = token[:len(token)//2] + ("A" if token[len(token)//2] != "A" else "B") + token[len(token)//2+1:]
        with pytest.raises(jwt.InvalidTokenError):
            decode_token(tampered, expected_type="access")

    def test_rejects_expired_token(self):
        # Craft an already-expired token
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-exp",
            "jti": str(uuid.uuid4()),
            "type": "access",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        }
        expired_token = jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")

        with pytest.raises(jwt.ExpiredSignatureError):
            decode_token(expired_token, expected_type="access")

    def test_rejects_refresh_token_when_access_expected(self):
        tokens = issue_tokens("user-abc")
        with pytest.raises(jwt.InvalidTokenError, match="Expected token type"):
            decode_token(tokens["refresh_token"], expected_type="access")

    def test_rejects_access_token_when_refresh_expected(self):
        tokens = issue_tokens("user-abc")
        with pytest.raises(jwt.InvalidTokenError, match="Expected token type"):
            decode_token(tokens["access_token"], expected_type="refresh")

    def test_rejects_token_signed_with_wrong_secret(self):
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-wrong",
            "jti": str(uuid.uuid4()),
            "type": "access",
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        bad_token = jwt.encode(payload, "wrong-secret-key", algorithm="HS256")
        with pytest.raises(jwt.InvalidTokenError):
            decode_token(bad_token, expected_type="access")


# ── Revocation tests ─────────────────────────────────────────────────

class TestRevocation:
    @patch("services.auth_service.get_db")
    def test_revoke_inserts_jti(self, mock_get_db):
        db = MagicMock()
        mock_get_db.return_value = db
        expires = datetime.now(timezone.utc) + timedelta(hours=1)

        revoke("jti-123", expires)
        db.token_blocklist.insert_one.assert_called_once_with({
            "jti": "jti-123",
            "expires_at": expires,
        })

    @patch("services.auth_service.get_db")
    def test_is_revoked_true_when_jti_exists(self, mock_get_db):
        db = MagicMock()
        db.token_blocklist.find_one.return_value = {"_id": "x", "jti": "jti-abc"}
        mock_get_db.return_value = db

        assert is_revoked("jti-abc") is True

    @patch("services.auth_service.get_db")
    def test_is_revoked_false_when_jti_missing(self, mock_get_db):
        db = MagicMock()
        db.token_blocklist.find_one.return_value = None
        mock_get_db.return_value = db

        assert is_revoked("jti-xyz") is False

    @patch("services.auth_service.get_db")
    def test_revoked_token_is_detected(self, mock_get_db):
        """Full round-trip: issue → revoke → check is_revoked."""
        db = MagicMock()
        db.token_blocklist.find_one.return_value = {"_id": "1", "jti": "some-jti"}
        mock_get_db.return_value = db

        tokens = issue_tokens("user-rev")
        payload = decode_token(tokens["access_token"], expected_type="access")
        revoke(payload["jti"], datetime.now(timezone.utc) + timedelta(hours=1))

        assert is_revoked(payload["jti"]) is True
