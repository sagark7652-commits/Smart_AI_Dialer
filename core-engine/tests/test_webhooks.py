"""Unit tests for Result Webhooks (HMAC-SHA256 signatures, retries, dead-letter queue, replay)."""

import asyncio
import hashlib
import hmac
import json
import time
import pytest
from agent.webhooks.dispatcher import WebhookDispatcher, get_webhook_dispatcher
from agent.db import get_db, WebhookConfigModel, WebhookDeadLetterModel, WebhookEventModel


@pytest.mark.asyncio
async def test_webhook_signature_generation_and_verification():
    dispatcher = WebhookDispatcher()
    secret = "test-secret-key-12345"
    timestamp = int(time.time())
    payload = json.dumps({"event": "call.ended", "call_id": "call_abc123"})

    sig = dispatcher.generate_signature(secret, timestamp, payload)
    assert sig is not None
    assert len(sig) == 64  # SHA-256 hex string

    # Verify matching signature
    is_valid = dispatcher.verify_signature(
        secret=secret,
        timestamp=timestamp,
        payload_str=payload,
        provided_signature=sig,
    )
    assert is_valid is True

    # Verify tampered payload fails
    tampered_valid = dispatcher.verify_signature(
        secret=secret,
        timestamp=timestamp,
        payload_str=payload + "tampered",
        provided_signature=sig,
    )
    assert tampered_valid is False

    # Verify expired timestamp fails tolerance
    expired_valid = dispatcher.verify_signature(
        secret=secret,
        timestamp=timestamp - 600,  # 10 minutes old
        payload_str=payload,
        provided_signature=sig,
        tolerance_sec=300,
    )
    assert expired_valid is False


@pytest.mark.asyncio
async def test_webhook_mask_phone_number():
    dispatcher = WebhookDispatcher()
    assert dispatcher.mask_phone_number("+919876543210") == "*********3210"
    assert dispatcher.mask_phone_number("9876") == "9876"
    assert dispatcher.mask_phone_number(None) == "XXXX"


@pytest.mark.asyncio
async def test_webhook_delivery_failure_writes_to_dead_letter():
    db = get_db()
    await db.init_db()

    dispatcher = WebhookDispatcher()
    # Temporarily set fast retries for testing
    dispatcher.BACKOFF_DELAYS = [0.01, 0.01, 0.01, 0.01, 0.01]

    # Target an unreachable port
    unreachable_url = "http://127.0.0.1:59999/unreachable-webhook"
    secret = "dlq-secret-key"

    # Clean up any leftover test configs
    async with db.session_factory() as session:
        import sqlalchemy as sa
        await session.execute(sa.delete(WebhookConfigModel).where(WebhookConfigModel.url == unreachable_url))
        cfg = WebhookConfigModel(
            url=unreachable_url,
            signing_secret=secret,
            is_active=True,
            events='["call.ended"]',
        )
        session.add(cfg)
        await session.commit()

    test_idempotency_key = f"test_idemp_{int(time.time() * 1000)}"

    # Execute async dispatch directly
    await dispatcher._dispatch_async(
        event_type="call.ended",
        payload={"call_id": "call_dlq_test", "outcome": "completed"},
        agent_id="test_agent",
        call_id="call_dlq_test",
        api_key_id=None,
        idempotency_key=test_idempotency_key,
    )

    # Check dead letter queue table
    async with db.session_factory() as session:
        import sqlalchemy as sa
        stmt = sa.select(WebhookDeadLetterModel).where(
            WebhookDeadLetterModel.idempotency_key == test_idempotency_key
        )
        dl_items = list((await session.execute(stmt)).scalars().all())
        assert len(dl_items) >= 1
        dl_item = dl_items[0]
        assert dl_item.attempts == 5
        assert dl_item.event_type == "call.ended"
        assert unreachable_url in dl_item.url


@pytest.mark.asyncio
async def test_webhook_failures_never_crash_caller():
    dispatcher = get_webhook_dispatcher()
    # Dispatching with invalid or failing params should run fire-and-forget without exception
    dispatcher.dispatch(
        event_type="call.started",
        payload={"dummy": "data"},
        agent_id="nonexistent_agent",
        call_id="call_safe_test",
    )
    # Caller proceeds immediately without error
    assert True
