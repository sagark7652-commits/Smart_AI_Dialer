"""Test suite for Item 4: DTMF (Dual-Tone Multi-Frequency) Keypad Input.

Validates:
1. Interactive menu configuration (Press 1 confirm, 2 callback, 9 human).
2. Valid digit processing & action resolution.
3. Invalid digit handling and retry limit exhaustion.
4. Timeout handling and fallback escalation.
5. Security & Safety: Redaction and hard rejection of card numbers, PINs, OTPs via DTMF.
6. Twilio WebSocket DTMF event parsing.
7. Exotel HTTP Gather webhook handling.
8. Call record and transcript persistence.
"""

import asyncio
import json
import pytest
from fastapi.testclient import TestClient
from agent.dtmf import DTMFHandler, DTMFConfig, DTMFResult
from agent.telephony.twilio_provider import TwilioProvider
from server import app, engine


client = TestClient(app)


def test_dtmf_menu_and_valid_actions():
    """Verify standard menu flow: 1 (confirm), 2 (callback), 9 (human agent)."""
    handler = DTMFHandler(call_id="call_dtmf_01")
    prompt = handler.start_menu()
    assert "1" in prompt
    assert handler.state == "awaiting_dtmf"

    # Test 1 -> confirm
    res1 = handler.process_digit("1")
    assert res1.status == "success"
    assert res1.digit == "1"
    assert res1.action == "confirm"
    assert handler.state == "resolved"

    # Reset menu for next digit
    handler.start_menu()
    res2 = handler.process_digit("2")
    assert res2.status == "success"
    assert res2.action == "callback"

    # Reset menu for human transfer
    handler.start_menu()
    res9 = handler.process_digit("9")
    assert res9.status == "success"
    assert res9.action == "transfer_human"


def test_dtmf_invalid_retry_and_exhaustion():
    """Verify invalid keypad inputs prompt retries and escalate when exhausted."""
    handler = DTMFHandler(call_id="call_dtmf_02", default_config=DTMFConfig(menu_id="test_m", max_retries=2))
    handler.start_menu()

    # Attempt 1: Invalid digit '7'
    res = handler.process_digit("7")
    assert res.status == "retry"
    assert res.action == "retry"
    assert res.retries_used == 1
    assert "अमान्य इनपुट" in res.prompt

    # Attempt 2: Invalid digit '8'
    res = handler.process_digit("8")
    assert res.status == "retry"
    assert res.retries_used == 2

    # Attempt 3: Exceeds max_retries (2)
    res = handler.process_digit("5")
    assert res.status == "failed"
    assert res.action == "transfer_human"
    assert handler.state == "failed"
    assert "प्रतिनिधि" in res.prompt


def test_dtmf_timeout_handling():
    """Verify timeout events retry and then escalate."""
    handler = DTMFHandler(call_id="call_dtmf_03", default_config=DTMFConfig(menu_id="timeout_m", max_retries=1))
    handler.start_menu()

    # Timeout 1: Retry prompt
    res = handler.process_timeout()
    assert res.status == "timeout_retry"
    assert res.retries_used == 1
    assert "इनपुट" in res.prompt

    # Timeout 2: Exceeded -> Escalate
    res = handler.process_timeout()
    assert res.status == "timeout_failed"
    assert res.action == "transfer_human"
    assert handler.state == "failed"


def test_dtmf_sensitive_digit_redaction_and_rejection():
    """Verify card numbers, OTPs, and PINs entered via DTMF are redacted as '****' and blocked."""
    handler = DTMFHandler(call_id="call_dtmf_04")
    handler.start_menu()

    # Credit card sequence via DTMF (16 digits)
    res_card = handler.process_digit("4532111122223333")
    assert res_card.status == "rejected_sensitive"
    assert res_card.digit == "****"
    assert res_card.is_sensitive is True
    assert "कार्ड नंबर, पिन या ओटीपी स्वीकार नहीं किया जा सकता" in res_card.prompt

    # Common PIN sequence '1234'
    res_pin = handler.process_digit("1234")
    assert res_pin.status == "rejected_sensitive"
    assert res_pin.digit == "****"

    # Verify history recorded no plain sensitive numbers
    for item in handler.history:
        assert "4532111122223333" not in str(item)
        assert "1234" not in str(item)


@pytest.mark.asyncio
async def test_twilio_websocket_dtmf_parsing():
    """Verify TwilioProvider parses native WebSocket DTMF event and invokes callback."""
    provider = TwilioProvider()
    received_digits = []

    def on_dtmf(digit: str):
        received_digits.append(digit)

    provider.set_dtmf_callback(on_dtmf)

    # Simulated Twilio WebSocket message
    msg = json.dumps({
        "event": "dtmf",
        "streamSid": "MZ1234567890",
        "dtmf": {
            "track": "inbound_track",
            "digit": "1"
        }
    })

    await provider.handle_inbound_message(msg)
    assert received_digits == ["1"]


@pytest.mark.asyncio
async def test_pipeline_handle_dtmf_and_transcript():
    """Verify pipeline processes DTMF, speaks prompt, and logs formatted entry to transcript."""
    provider = TwilioProvider()
    pipeline = engine.create_pipeline(telephony_provider=provider, call_id="call_dtmf_pipe_test")

    # Send valid digit '1'
    res = await pipeline.handle_dtmf_digit("1")
    assert res["status"] == "success"
    assert res["digit"] == "1"
    assert res["action"] == "confirm"

    # Verify transcript entry
    last_user_entry = next(
        (e for e in reversed(pipeline._transcript_history) if e.role == "user"), None
    )
    assert last_user_entry is not None
    assert "[DTMF Key: 1 | Action: confirm]" in last_user_entry.text

    # Send sensitive OTP
    res_sens = await pipeline.handle_dtmf_digit("9876")
    assert res_sens["status"] == "rejected_sensitive"
    assert res_sens["digit"] == "****"

    # Verify redacted in user transcript
    user_entries = [e for e in pipeline._transcript_history if e.role == "user"]
    last_user_entry = user_entries[-1]
    assert "****" in last_user_entry.text
    assert "9876" not in last_user_entry.text


def test_server_dtmf_endpoints():
    """Verify /calls/{call_id}/dtmf and /webhooks/exotel/dtmf HTTP endpoints."""
    call_id = "test_active_dtmf_call"
    provider = TwilioProvider()
    pipeline = engine.create_pipeline(telephony_provider=provider, call_id=call_id)
    engine._active_calls[call_id] = pipeline

    try:
        # 1. Direct API endpoint /calls/{call_id}/dtmf
        resp = client.post(f"/calls/{call_id}/dtmf", json={"digit": "2"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["result"]["action"] == "callback"

        # 2. Exotel HTTP Gather webhook /webhooks/exotel/dtmf
        exotel_resp = client.post(
            "/webhooks/exotel/dtmf",
            data={"CallSid": call_id, "Digits": "9"}
        )
        assert exotel_resp.status_code == 200
        exotel_data = exotel_resp.json()
        assert exotel_data["status"] == "processed"
        assert exotel_data["result"]["action"] == "transfer_human"

    finally:
        if call_id in engine._active_calls:
            del engine._active_calls[call_id]
