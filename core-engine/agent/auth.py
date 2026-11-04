"""API key authentication, SHA-256 hash validation, and per-key sliding window rate limiting."""

from collections import defaultdict
import hashlib
import time
from typing import Dict, List
from fastapi import Header, HTTPException, status
from agent.db import APIKeyModel, get_db
from agent.logger import setup_logger

logger = setup_logger("auth")

# In-memory sliding-window request timestamps per key_hash
_rate_limit_buckets: Dict[str, List[float]] = defaultdict(list)


def hash_key(raw_key: str) -> str:
    """Compute SHA-256 hex digest of the raw API key."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()


async def verify_api_key(
    x_api_key: str = Header(..., description="API secret key prefixed with ca_live_"),
) -> APIKeyModel:
    """FastAPI dependency: authenticates hashed API key and enforces per-minute rate limits."""
    if not x_api_key or not x_api_key.startswith("ca_live_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key format.",
        )

    key_digest = hash_key(x_api_key)
    db = get_db()
    key_record = await db.get_api_key_by_hash(key_digest)

    if not key_record or not key_record.is_active:
        logger.warning(f"Unauthorized API access attempt with key prefix: {x_api_key[:12]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
        )

    # Enforce sliding-window rate limit
    now = time.time()
    window_start = now - 60.0
    timestamps = _rate_limit_buckets[key_digest]

    # Evict timestamps older than 60s
    valid_timestamps = [t for t in timestamps if t > window_start]
    _rate_limit_buckets[key_digest] = valid_timestamps

    if len(valid_timestamps) >= key_record.rate_limit_per_minute:
        logger.warning(
            f"Rate limit exceeded for key ID {key_record.id} ({key_record.prefix}...): "
            f"{len(valid_timestamps)}/{key_record.rate_limit_per_minute} req/min"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({key_record.rate_limit_per_minute} req/min). Please slow down.",
        )

    _rate_limit_buckets[key_digest].append(now)
    return key_record
