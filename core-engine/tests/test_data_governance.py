"""Test suite for Tier 1 Item 2: Data Governance, PII Redaction, Signed URLs, and Privacy."""

import asyncio
import os
from pathlib import Path
import time
import pytest
from fastapi.testclient import TestClient

from agent.db import get_db
from agent.auth import hash_key
from agent.governance import (
    PIIRedactor,
    PIIRedactionConfig,
    RecordingAccessController,
    ConsentManager,
    DataGovernanceManager,
    RetentionPolicy,
)
from server import app

client = TestClient(app)


def test_pii_redactor_comprehensive():
    """Verify phone, email, Aadhaar, PAN, card, OTP, and pin code redactions."""
    redactor = PIIRedactor()

    # Phone number
    text1 = "Contact me on +919876543210 or 9123456789 tomorrow."
    r1 = redactor.redact_text(text1)
    assert "9876543210" not in r1
    assert "3210" in r1

    # Email
    text2 = "Send invoice to rahul.sharma@apexbank.in please."
    r2 = redactor.redact_text(text2)
    assert "rahul.sharma" not in r2
    assert "@apexbank.in" in r2

    # Aadhaar (12 digits)
    text3 = "My Aadhaar number is 5432 1234 9876 for KYC."
    r3 = redactor.redact_text(text3)
    assert "5432 1234" not in r3
    assert "XXXX-XXXX-9876" in r3

    # PAN card (10-char alphanumeric)
    text4 = "My PAN card is ABCDE1234F."
    r4 = redactor.redact_text(text4)
    assert "ABCDE1234F" not in r4
    assert "ABCDE****F" in r4

    # Financial: Credit card and OTP
    text5 = "Card is 4111-2222-3333-4444 and my OTP is 482910."
    r5 = redactor.redact_text(text5)
    assert "4111" not in r5
    assert "482910" not in r5
    assert "[REDACTED_SECURITY_CODE]" in r5

    # PIN code
    text6 = "I live in Mumbai, PIN code is 400001 near station."
    r6 = redactor.redact_text(text6)
    assert "400001" not in r6
    assert "[PINCODE_XXXXXX]" in r6


def test_recording_signed_url_and_access_control():
    """Verify signed URLs expire, reject tampered tokens, and log audit trail."""
    controller = RecordingAccessController(secret_key="unit-test-secret", default_ttl_sec=1)

    call_id = "test_call_rec_123"
    # Generate signed URL valid for 1 second
    signed_url = controller.generate_signed_url(call_id=call_id, track="agent", ttl_sec=1)
    assert f"/recordings/{call_id}/stream" in signed_url
    assert "expires=" in signed_url
    assert "signature=" in signed_url

    # Parse params
    import urllib.parse
    parsed = urllib.parse.urlparse(signed_url)
    qs = urllib.parse.parse_qs(parsed.query)
    expires_at = int(qs["expires"][0])
    sig = qs["signature"][0]

    # Valid token passes
    assert controller.verify_token(call_id, "agent", expires_at, sig) is True

    # Tampered signature fails
    assert controller.verify_token(call_id, "agent", expires_at, "tampered_sig_12345") is False

    # Wait for token expiration (1.1s)
    time.sleep(1.1)
    assert controller.verify_token(call_id, "agent", expires_at, sig) is False

    # Verify audit trail
    controller.log_access("auditor_01", "view_transcript", call_id)
    trail = controller.get_audit_trail(limit=5)
    assert any(e["action"] == "view_transcript" for e in trail)


def test_consent_logging():
    """Verify consent logging, masked phone display, and retrieval by phone."""
    mgr = ConsentManager()
    call_id = "call_consent_test"
    phone = "+919876543210"

    # Grant recording consent
    rec1 = mgr.log_consent(call_id, phone, "recording", "granted", channel="voice_verbal", turn_text="Haan theek hai record kar lijiye")
    assert rec1.status == "granted"

    # Revoke later
    rec2 = mgr.log_consent(call_id, phone, "recording", "revoked", channel="voice_verbal", turn_text="Abhi recording band karo")
    assert rec2.status == "revoked"

    history = mgr.get_consents_for_phone(phone)
    assert len(history) >= 2
    assert history[-1]["status"] == "revoked"


@pytest.mark.asyncio
async def test_data_subject_export_and_deletion(tmp_path):
    """Verify GDPR/DPDP export and deletion of calls, files, and transcripts."""
    db = get_db()
    await db.init_db()

    # Create dummy files
    rec_dir = tmp_path / "recordings"
    trx_dir = tmp_path / "transcripts"
    met_dir = tmp_path / "metrics"
    rec_dir.mkdir()
    trx_dir.mkdir()
    met_dir.mkdir()

    call_id = f"subj_call_{int(time.time())}"
    phone = "+919123456789"

    # Create dummy files
    (rec_dir / f"{call_id}_agent.wav").write_text("dummy audio")
    (trx_dir / f"session_{call_id}.json").write_text("dummy transcript")
    (met_dir / f"metrics_{call_id}.json").write_text("dummy metrics")

    # Save to database
    await db.create_call(call_id=call_id, caller_number=phone, direction="outbound", status="completed")

    gov = DataGovernanceManager(
        recordings_dir=str(rec_dir),
        transcripts_dir=str(trx_dir),
        metrics_dir=str(met_dir),
    )

    # 1. Export Data
    export_bundle = await gov.export_data_for_phone(phone, db=db)
    assert export_bundle["total_calls_found"] >= 1
    assert any(c["call_id"] == call_id for c in export_bundle["calls"])

    # 2. Delete Data (Right to Erasure)
    del_result = await gov.delete_data_for_phone(phone, db=db)
    assert del_result["deleted_calls_count"] >= 1
    assert del_result["deleted_files_count"] >= 3

    # Verify physical files removed
    assert not (rec_dir / f"{call_id}_agent.wav").exists()
    assert not (trx_dir / f"session_{call_id}.json").exists()


@pytest.mark.asyncio
async def test_governance_api_endpoints():
    """Verify REST endpoints for data export, deletion, and signed URL generation."""
    db = get_db()
    await db.init_db()

    # Create API key
    raw_key = f"ca_live_gov_{int(time.time()*1000)}"
    khash = hash_key(raw_key)
    await db.create_api_key(name="gov_tester", key_hash=khash, prefix=raw_key[:12])
    headers = {"x-api-key": raw_key}

    phone = "+919876543210"
    call_id = f"api_gov_call_{int(time.time())}"
    await db.create_call(call_id=call_id, caller_number=phone, direction="outbound", status="completed")

    # 1. Record consent
    c_resp = client.post(
        f"/calls/{call_id}/consent",
        json={"phone": phone, "consent_type": "callback", "status": "granted"},
        headers=headers,
    )
    assert c_resp.status_code == 200

    # 2. Get signed URL for recording
    url_resp = client.get(f"/recordings/{call_id}/signed-url?track=agent", headers=headers)
    assert url_resp.status_code == 200
    assert "signed_url" in url_resp.json()

    # 3. Export data
    exp_resp = client.get(f"/data/{phone}/export", headers=headers)
    assert exp_resp.status_code == 200
    assert exp_resp.json()["total_calls_found"] >= 1

    # 4. Delete data
    del_resp = client.delete(f"/data/{phone}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"
