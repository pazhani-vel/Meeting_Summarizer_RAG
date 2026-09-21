"""
Lazy-singleton MongoDB connection.

The client is created on first access, not at import time.
Mirrors the lazy-singleton pattern used in app.py for components.
"""

from pymongo import MongoClient
import config

_client: MongoClient | None = None


def get_client() -> MongoClient:
    """Return a shared MongoClient, creating it on first call."""
    global _client
    if _client is None:
        _client = MongoClient(config.MONGO_URI)
    return _client


def get_db():
    """Return the application database."""
    return get_client()[config.MONGO_DB_NAME]
