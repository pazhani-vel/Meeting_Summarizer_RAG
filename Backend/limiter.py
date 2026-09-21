"""
Shared Flask-Limiter instance.

Import from here to avoid circular imports:
    from limiter import limiter
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    storage_uri="memory://",
)
