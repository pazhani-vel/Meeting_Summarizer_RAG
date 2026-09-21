"""
Authentication blueprint.

Endpoints:
    POST /auth/register   – create account, return tokens
    POST /auth/login      – verify credentials, return tokens
    POST /auth/refresh    – exchange refresh token for new access token
    POST /auth/logout     – revoke access (+ optional refresh) token
    GET  /auth/me         – return the authenticated user's profile
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, current_app, g, jsonify, request

from limiter import limiter
from services.auth_decorator import require_auth
from services.auth_service import (
    DuplicateEmailError,
    authenticate,
    create_user,
    decode_token,
    is_revoked,
    issue_tokens,
    revoke,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# ── POST /auth/register ──────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10/minute")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password are required."}), 400

    try:
        user = create_user(email, password)
    except DuplicateEmailError:
        return jsonify({"status": "error", "message": "An account with this email already exists."}), 409
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400

    tokens = issue_tokens(user["_id"])

    return jsonify({
        "status": "success",
        "user": {"id": user["_id"], "email": user["email"], "created_at": user["created_at"].isoformat()},
        **tokens,
    }), 201


# ── POST /auth/login ────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10/minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password are required."}), 400

    user = authenticate(email, password)
    if user is None:
        return jsonify({"status": "error", "message": "Invalid email or password."}), 401

    tokens = issue_tokens(user["_id"])

    return jsonify({
        "status": "success",
        "user": {"id": user["_id"], "email": user["email"]},
        **tokens,
    }), 200


# ── POST /auth/refresh ──────────────────────────────────────────────

@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    data = request.get_json(silent=True) or {}
    refresh_token = data.get("refresh_token") or ""

    if not refresh_token:
        return jsonify({"status": "error", "message": "refresh_token is required."}), 400

    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except jwt.ExpiredSignatureError:
        return jsonify({"status": "error", "message": "Refresh token has expired."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"status": "error", "message": "Invalid refresh token."}), 401

    jti = payload.get("jti")
    if jti and is_revoked(jti):
        return jsonify({"status": "error", "message": "Refresh token has been revoked."}), 401

    # Issue a new access token (the refresh token stays valid)
    tokens = issue_tokens(payload["sub"])
    return jsonify({
        "status": "success",
        "access_token": tokens["access_token"],
    }), 200


# ── POST /auth/logout ───────────────────────────────────────────────

@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    """
    Revoke the presented access token's jti.
    If a refresh_token is supplied in the body, revoke that too.
    Idempotent — revoking an already-revoked token is not an error.
    """
    # Revoke the access token that was used to authenticate this request
    access_jti = g.get("jti")
    access_exp = g.get("token_exp")
    if access_jti and access_exp:
        _safe_revoke(access_jti, access_exp)

    # Optionally revoke the refresh token from the body
    data = request.get_json(silent=True) or {}
    refresh_token = data.get("refresh_token")
    if refresh_token:
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            _safe_revoke(payload.get("jti"), payload.get("exp"))
        except jwt.InvalidTokenError:
            pass  # Invalid/expired refresh token — nothing to revoke

    return jsonify({"status": "success"}), 200


# ── GET /auth/me ─────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
@require_auth
def me():
    from models.db import get_db
    db = get_db()
    user = db.users.find_one({"_id": g.user_id}, {"password_hash": 0})
    if not user:
        return jsonify({"status": "error", "message": "User not found."}), 404

    created_at = user.get("created_at")
    return jsonify({
        "status": "success",
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        },
    }), 200


# ── helpers ──────────────────────────────────────────────────────────

def _safe_revoke(jti: str | None, exp_timestamp) -> None:
    """Revoke a jti, ignoring errors. Converts exp to datetime if needed."""
    if not jti:
        return
    if isinstance(exp_timestamp, datetime):
        expires_at = exp_timestamp
    elif isinstance(exp_timestamp, (int, float)):
        expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    try:
        revoke(jti, expires_at)
    except Exception:
        pass  # Best-effort revocation
