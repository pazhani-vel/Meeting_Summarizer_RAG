"""
Re-export the canonical MongoDB connection from db.mongo.

This module exists solely for backwards compatibility with
imports like ``from models.db import get_db``. All new code
should import directly from ``db.mongo`` instead.
"""
from db.mongo import get_client, get_db

__all__ = ["get_client", "get_db"]
