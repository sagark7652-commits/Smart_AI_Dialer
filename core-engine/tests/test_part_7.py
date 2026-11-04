"""Unit and integration tests for Part 7: Business & Scale.

Covers:
- Usage Tracking & GET /usage
- Per-Call Cost Calculator
- HMAC-Signed Webhook Verification & Dispatch
- Compliance: IST Calling Window & DND Blacklist
- Concurrency Manager & Overload Backpressure
- Campaign Mode: Create, Pause, Resume, Cancel
- Load Testing Harness Execution
"""

import asyncio
from datetime import datetime, timezone
import json
import time
from fastapi.testclient import TestClient
import pytest
from agent.auth import hash_key
from agent.campaign import CampaignRunner
from agent.compliance import ComplianceEngine, get_compliance_engine, IST_OFFSET
from agent.concurrency import ConcurrencyManager, ConcurrencyOverloadException
from agent.cost_calculator import CostCalculator
from agent.db import get_db
from agent.webhooks import WebhookDispatcher, compute_hmac_signature, verify_hmac_signature
from load_test import run_load_test
from server import app

client = TestClient(app)


# ============================================================================
# 1. USAGE TRACKING & BILLING TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_usage_tracking_and_api():
    db = get_db()
    await db.init_db()

    raw_key = f"ca_live_usage_{int(time.time()*1000)}"
    khash = hash_key(raw_key)
    api_key = await db.create_api_key(name="usage_tester", key_hash=khash, prefix=raw_key[:12])
    headers = {"x-api-key": raw_key}

    # Record 2 usage records
    await db.record_usage(
        call_id=f"c1_{int(time.time())}",
        api_key_id=api_key.id,
        call_duration_sec=120.0,
        stt_seconds=50.0,
        llm_prompt_tokens=400,
        llm_completion_tokens=150,
        tts_characters=300,
        estimated_cost_usd=0.025,
    )
    await db.record_usage(
        call_id=f"c2_{int(time.time())}",
        api_key_id=api_key.id,
        call_duration_sec=60.0,
        stt_seconds=25.0,
        llm_prompt_tokens=200,
        llm_completion_tokens=80,
        tts_characters=150,
        estimated_cost_usd=0.012,
    )

    res = client.get("/usage", headers=headers)
    assert res.status_code == 200
    data = res.json()["usage"]
    assert data["total_calls"] >= 2
    assert data["total_duration_minutes"] >= 3.0
    assert data["total_prompt_tokens"] >= 600
    assert data["total_estimated_cost_usd"] >= 0.037


def test_cost_calculator_breakdown():
    calc = CostCalculator()
    breakdown = calc.calculate_call_cost(
        call_id="call_test_cost",
        duration_sec=60.0,
        stt_seconds=30.0,
        prompt_tokens=1000,
        completion_tokens=500,
        tts_chars=1000,
    )
    d = breakdown.to_dict()
    assert d["stt_cost_usd"] > 0
    assert d["llm_cost_usd"] > 0
    assert d["tts_cost_usd"] > 0
    assert d["telephony_cost_usd"] > 0
    assert d["total_cost_usd"] > 0
    assert d["total_cost_usd"] == round(
        d["stt_cost_usd"] + d["llm_cost_usd"] + d["tts_cost_usd"] + d["telephony_cost_usd"], 5
    )


# ============================================================================
# 2. HMAC-SIGNED WEBHOOK TESTS
# ============================================================================

def test_hmac_webhook_signature():
    secret = "test-secret-key-42"
    payload = {"call_id": "test_123", "status": "completed", "outcome": "booked"}
    payload_bytes = json.dumps(payload).encode("utf-8")

    sig = compute_hmac_signature(payload_bytes, secret)
    assert len(sig) == 64  # SHA-256 hex digest length

    # Verify matching
    assert verify_hmac_signature(payload_bytes, sig, secret) is True
    assert verify_hmac_signature(payload_bytes, f"sha256={sig}", secret) is True

    # Tampered payload fails
    tampered = json.dumps({"call_id": "test_123", "status": "failed"}).encode("utf-8")
    assert verify_hmac_signature(tampered, sig, secret) is False


# ============================================================================
# 3. COMPLIANCE & DND REGISTRY TESTS
# ============================================================================

def test_compliance_calling_window_ist():
    comp = ComplianceEngine()

    # 11:00 AM IST (05:30 UTC) -> should be within window [09:00 - 20:00]
    dt_day = datetime(2026, 3, 15, 5, 30, tzinfo=timezone.utc)
    assert comp.is_within_calling_window(dt_utc=dt_day) is True

    # 11:30 PM IST (18:00 UTC) -> should be outside window
    dt_night = datetime(2026, 3, 15, 18, 0, tzinfo=timezone.utc)
    assert comp.is_within_calling_window(dt_utc=dt_night) is False


@pytest.mark.asyncio
async def test_dnd_registry_api_and_call_blocking():
    db = get_db()
    await db.init_db()

    raw_key = f"ca_live_dnd_{int(time.time()*1000)}"
    khash = hash_key(raw_key)
    await db.create_api_key(name="dnd_tester", key_hash=khash, prefix=raw_key[:12])
    headers = {"x-api-key": raw_key}

    test_phone = "+919988776655"

    # Add to DND
    res_add = client.post("/compliance/dnd", json={"phone_number": test_phone, "reason": "Customer request"}, headers=headers)
    assert res_add.status_code == 201

    # Check status
    res_chk = client.get(f"/compliance/dnd/{test_phone}", headers=headers)
    assert res_chk.status_code == 200
    assert res_chk.json()["is_dnd"] is True

    # Verify POST /calls is blocked with 403 Forbidden
    res_call = client.post(
        "/calls",
        json={"to_number": test_phone, "enforce_compliance": True},
        headers=headers,
    )
    assert res_call.status_code == 403
    assert "DND" in res_call.json()["detail"]

    # Remove from DND
    res_del = client.delete(f"/compliance/dnd/{test_phone}", headers=headers)
    assert res_del.status_code == 200

    # Check status unblocked
    res_chk2 = client.get(f"/compliance/dnd/{test_phone}", headers=headers)
    assert res_chk2.json()["is_dnd"] is False


# ============================================================================
# 4. CONCURRENCY & OVERLOAD QUEUE TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_concurrency_manager_limits():
    # 2 concurrent slots, 1 queue slot
    cm = ConcurrencyManager(max_concurrent_calls=2, max_queue_size=1)

    # Acquire 2 slots
    assert await cm.acquire_slot() is True
    assert await cm.acquire_slot() is True
    assert cm.active_calls == 2

    # Release 1 slot
    cm.release_slot()
    assert cm.active_calls == 1

    # Acquire again
    assert await cm.acquire_slot() is True
    assert cm.active_calls == 2

    # Clean up
    cm.release_slot()
    cm.release_slot()
    assert cm.active_calls == 0


# ============================================================================
# 5. CAMPAIGN MODE TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_campaign_lifecycle_api():
    db = get_db()
    await db.init_db()

    raw_key = f"ca_live_camp_{int(time.time()*1000)}"
    khash = hash_key(raw_key)
    await db.create_api_key(name="camp_tester", key_hash=khash, prefix=raw_key[:12])
    headers = {"x-api-key": raw_key}

    # Create agent first
    agent_id = f"camp_agent_{int(time.time())}"
    client.post(
        "/agents",
        json={
            "id": agent_id,
            "name": "Campaign Agent",
            "system_prompt": "You are a campaign calling agent.",
            "greeting": "Namaste from Aarogya!",
        },
        headers=headers,
    )

    # Create campaign
    camp_payload = {
        "name": "March Dental Camp",
        "agent_id": agent_id,
        "phone_numbers": ["+919876500001", "+919876500002", "+919876500003"],
        "max_concurrency": 2,
    }
    res = client.post("/campaigns", json=camp_payload, headers=headers)
    assert res.status_code == 201
    camp_id = res.json()["campaign_id"]

    # Check campaign status
    res_status = client.get(f"/campaigns/{camp_id}", headers=headers)
    assert res_status.status_code == 200
    assert res_status.json()["total_contacts"] == 3

    # Pause campaign
    res_pause = client.post(f"/campaigns/{camp_id}/pause", headers=headers)
    assert res_pause.status_code == 200
    assert res_pause.json()["status"] == "paused"

    # Resume campaign
    res_resume = client.post(f"/campaigns/{camp_id}/resume", headers=headers)
    assert res_resume.status_code == 200
    assert res_resume.json()["status"] == "resumed"

    # Cancel campaign
    res_cancel = client.post(f"/campaigns/{camp_id}/cancel", headers=headers)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "cancelled"


# ============================================================================
# 6. LOAD TESTING SCRIPT TEST
# ============================================================================

@pytest.mark.asyncio
async def test_load_testing_execution():
    res = await run_load_test(total_calls=4, max_concurrency=2)
    assert res["total_calls"] == 4
    assert res["successful"] == 4
    assert res["throughput_calls_per_sec"] > 0
