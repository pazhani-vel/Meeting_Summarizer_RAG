"""
Flask decorator that enforces JWT authentication.

Usage::

    from services.auth_decorator import require_auth

    @app.route("/protected")
    @require_auth
    def protected():
        user_id = g.user_id
        ...

The decorator:
  1. Reads ``Authorization: Bearer <token>`` from the request header.
  2. Decodes and verifies the token (signature + expiry + type="access").
  3. Checks the token's ``jti`` against the blocklist.
  4. Puts the user id on ``flask.g.user_id``.
  5. Returns a clean 401 JSON response for *any* failure — never 500.
"""

from __future__ import annotations

from functools import wraps

import jwt
from flask import g, jsonify, request

from services.auth_service import decode_token, is_revoked


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # ── extract token ────────────────────────────────────────
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _deny("Missing or invalid Authorization header")

        token = auth_header.split(" ", 1)[1]
        if not token:
            return _deny("Missing or invalid Authorization header")

        # ── decode & verify ──────────────────────────────────────
        try:
            payload = decode_token(token, expected_type="access")
        except jwt.ExpiredSignatureError:
            return _deny("Token has expired")
        except jwt.InvalidTokenError:
            return _deny("Invalid token")

        # ── blocklist check ──────────────────────────────────────
        jti = payload.get("jti")
        if jti and is_revoked(jti):
            return _deny("Token has been revoked")

        # ── attach to request context ────────────────────────────
        g.user_id = payload["sub"]
        g.jti = payload.get("jti")
        g.token_exp = payload.get("exp")

        return f(*args, **kwargs)

    return decorated


def _deny(message: str):
    """Return a 401 JSON error — never leaks a stack trace."""
    return jsonify({"status": "error", "message": message}), 401
