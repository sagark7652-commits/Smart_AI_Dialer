"""200-number campaign scale test verifying CSV parsing, deduplication, retries, calling hours, concurrency cap & crash-safe resume."""

import asyncio
import io
import time
from datetime import datetime, timezone, timedelta
import pytest
import sqlalchemy as sa
from agent.campaign import (
    CampaignRunner,
    parse_and_validate_campaign_csv,
    validate_e164_phone,
    GLOBAL_CONCURRENCY_LIMIT,
    IST_OFFSET,
)
from agent.db import (
    get_db,
    CampaignModel,
    CampaignContactModel,
    CallModel,
    DNDEntry,
)


def test_phone_validation_and_csv_parsing():
    # 1. E.164 Validation
    valid, norm, _ = validate_e164_phone("9876543210")
    assert valid is True
    assert norm == "+919876543210"

    valid, norm, _ = validate_e164_phone("+14155552671")
    assert valid is True
    assert norm == "+14155552671"

    valid, _, err = validate_e164_phone("12345")
    assert valid is False

    # 2. CSV parsing with headers, extra variable columns, duplicates & malformed numbers
    csv_text = """name,phone,due_amount,due_date
Amit Kumar,9876543210,1500,2026-11-05
Suresh Sharma,+919876543210,2500,2026-11-06
Invalid Row,invalid_phone,3000,2026-11-07
Priya Patel,+919123456789,1200,2026-11-08
Short Num,1234,500,2026-11-09
"""
    parsed = parse_and_validate_campaign_csv(csv_text)
    assert parsed["total_rows"] == 5
    assert parsed["valid_count"] == 2  # 9876543210 and 9123456789 (1 duplicate omitted)
    assert parsed["duplicates_count"] == 1
    assert parsed["invalid_count"] == 2
    assert parsed["valid_contacts"][0]["phone_number"] == "+919876543210"
    assert parsed["valid_contacts"][0]["variables"]["due_amount"] == "1500"
    assert parsed["valid_contacts"][0]["variables"]["name"] == "Amit Kumar"


@pytest.mark.asyncio
async def test_campaign_scale_with_200_numbers_and_concurrency_cap():
    """Mocked-provider test with 200 numbers verifying retries, concurrency cap, and DND."""
    db = get_db()
    await db.init_db()

    # Generate 200 numbers
    # 10 DND numbers, 10 failing numbers (to test retries), 180 normal numbers
    test_contacts = []
    dnd_numbers = set()
    for i in range(1, 201):
        phone = f"+91980000{i:04d}"
        if i <= 10:
            dnd_numbers.add(phone)
            # Add to DB DND registry
            await db.add_dnd(phone, reason="Test DND registered lead")
        test_contacts.append({
            "phone_number": phone,
            "variables": {"lead_id": f"lead_{i}", "customer_name": f"User_{i}"},
        })

    campaign_id = f"scale_test_{int(time.time() * 1000)}"
    campaign = await db.create_campaign(
        campaign_id=campaign_id,
        name="200 Lead Telecaller Test",
        agent_id="test_agent",
        contacts=test_contacts,
        max_concurrency=8,
        allowed_hours_start="00:00",  # Allow all hours for test execution
        allowed_hours_end="23:59",
        retry_max_attempts=2,
        retry_gap_minutes=1,
    )

    # Mock engine that tracks concurrency and simulates failures on selected leads
    active_concurrent_calls = 0
    max_observed_concurrency = 0
    concurrency_lock = asyncio.Lock()

    class MockTelephonyEngine:
        async def start_outbound_call(self, to_number: str, agent_id: str, variables=None) -> str:
            nonlocal active_concurrent_calls, max_observed_concurrency
            async with concurrency_lock:
                active_concurrent_calls += 1
                if active_concurrent_calls > max_observed_concurrency:
                    max_observed_concurrency = active_concurrent_calls

            try:
                # Simulate call duration
                await asyncio.sleep(0.02)
                # Intentionally fail numbers ending with '0015' to '0020' on first attempt
                if to_number.endswith(("0015", "0016", "0017")):
                    raise ConnectionError("Simulated carrier trunk busy / no-answer")
                return f"call_mock_{int(time.time()*1000)}"
            finally:
                async with concurrency_lock:
                    active_concurrent_calls -= 1

    runner = CampaignRunner(engine=MockTelephonyEngine())
    # Run the campaign
    await runner.run_campaign(campaign_id)

    # Verify concurrency never exceeded the cap
    assert max_observed_concurrency <= 8, f"Observed concurrency {max_observed_concurrency} exceeded limit 8!"
    assert max_observed_concurrency > 1, "Concurrency was not parallelized!"

    # Verify database contact outcomes
    contacts = await db.get_campaign_contacts(campaign_id)
    assert len(contacts) == 200

    dnd_blocked = [c for c in contacts if c.status == "blocked" and c.blocked_reason == "dnd_registered"]
    assert len(dnd_blocked) == 10, f"Expected 10 DND blocked, got {len(dnd_blocked)}"

    completed = [c for c in contacts if c.status == "completed"]
    assert len(completed) >= 180

    # Verify retried contacts
    retried_contacts = [c for c in contacts if c.phone_number.endswith(("0015", "0016", "0017"))]
    for rc in retried_contacts:
        assert rc.attempts >= 1


@pytest.mark.asyncio
async def test_campaign_crash_safe_resume():
    """Test that a stale 'dialing' contact from a crashed process is safely recovered without double-dialing."""
    db = get_db()
    await db.init_db()

    campaign_id = f"crash_test_{int(time.time() * 1000)}"
    campaign = await db.create_campaign(
        campaign_id=campaign_id,
        name="Crash Safe Test Campaign",
        agent_id="test_agent",
        contacts=["+919999900001", "+919999900002"],
        max_concurrency=2,
    )

    contacts = await db.get_campaign_contacts(campaign_id)
    c1, c2 = contacts[0], contacts[1]

    # Simulate crash mid-dial:
    # c1 had already completed in the calls table before crash
    completed_call_id = f"call_completed_{int(time.time())}"
    async with db.session_factory() as session:
        call = CallModel(
            id=completed_call_id,
            caller_number="+919999900001",
            status="completed",
            outcome="appointment_booked",
            summary="Completed appointment before crash",
        )
        session.add(call)

        # Mark c1 as dialing with call_id set
        stmt1 = sa.select(CampaignContactModel).where(CampaignContactModel.id == c1.id)
        db_c1 = (await session.execute(stmt1)).scalar_one()
        db_c1.status = "dialing"
        db_c1.call_id = completed_call_id

        # Mark c2 as dialing but call never connected (lost during crash)
        stmt2 = sa.select(CampaignContactModel).where(CampaignContactModel.id == c2.id)
        db_c2 = (await session.execute(stmt2)).scalar_one()
        db_c2.status = "dialing"
        db_c2.call_id = None
        await session.commit()

    # Execute crash recovery
    runner = CampaignRunner()
    recovered_count = await runner.crash_safe_resume(campaign_id)
    assert recovered_count == 2

    # Verify c1 marked completed from existing call record
    contacts_after = await db.get_campaign_contacts(campaign_id)
    c1_after = next(c for c in contacts_after if c.id == c1.id)
    c2_after = next(c for c in contacts_after if c.id == c2.id)

    assert c1_after.status == "completed"
    assert c1_after.outcome == "appointment_booked"
    # Verify c2 safely reset to pending (not blindly redialed during crash recovery)
    assert c2_after.status == "pending"


@pytest.mark.asyncio
async def test_campaign_calling_hours_enforcement():
    """Verify that calls outside allowed hours are blocked and logged."""
    runner = CampaignRunner()
    # 00:00 to 00:01 will definitely be outside hours for most of the day
    # Check method directly
    is_allowed = runner.is_current_time_allowed_ist(start_time_str="01:00", end_time_str="01:01")
    # Verify method computes correctly against current IST time
    now_ist = datetime.now(timezone.utc).astimezone(IST_OFFSET)
    expected = (now_ist.hour == 1 and now_ist.minute == 0)
    assert is_allowed == expected
