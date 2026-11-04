"""Unit tests for Callback Scheduler: persistence, hours adjustment, context handoff & max attempts."""

import asyncio
import time
from datetime import datetime, timezone, timedelta
import pytest
import sqlalchemy as sa
from agent.callback_scheduler import (
    CallbackScheduler,
    adjust_to_next_allowed_slot,
    parse_callback_time_ist,
    MAX_CALLBACK_ATTEMPTS,
)
from agent.compliance import IST_OFFSET
from agent.db import get_db, CallbackRequest, CallModel
from agent.tools.schedule_callback import ScheduleCallbackTool


def test_hours_slot_adjustment():
    now_ist = datetime.now(timezone.utc).astimezone(IST_OFFSET)

    # 1. Test night time (23:00) moves to tomorrow morning 09:30
    night_time = now_ist.replace(hour=23, minute=0, second=0)
    adjusted_dt, was_adjusted = adjust_to_next_allowed_slot(night_time, start_hour=9, end_hour=21)
    assert was_adjusted is True
    assert adjusted_dt.hour == 9
    assert adjusted_dt.minute == 30
    assert adjusted_dt.day == (night_time + timedelta(days=1)).day

    # 2. Test permitted time (14:00) remains untouched
    permitted_time = now_ist.replace(hour=14, minute=0, second=0)
    normal_dt, was_adjusted = adjust_to_next_allowed_slot(permitted_time, start_hour=9, end_hour=21)
    assert was_adjusted is False
    assert normal_dt.hour == 14

    # 3. Test parse_callback_time_ist with 'kal raat 11 baje'
    parsed_dt, was_adjusted = parse_callback_time_ist("kal raat 11 baje")
    assert was_adjusted is True
    assert parsed_dt.hour == 9


@pytest.mark.asyncio
async def test_tool_persistence_with_previous_call_context():
    db = get_db()
    await db.init_db()

    # Create dummy previous call with summary
    prev_call_id = f"prev_call_{int(time.time()*1000)}"
    async with db.session_factory() as session:
        call = CallModel(
            id=prev_call_id,
            caller_number="+919876543210",
            status="completed",
            outcome="callback",
            summary="Customer Rahul was busy in a flight; asked to call back tomorrow afternoon.",
        )
        session.add(call)
        await session.commit()

    # Execute tool
    tool = ScheduleCallbackTool()
    result = await tool.execute(
        preferred_time="tomorrow afternoon",
        phone_number="+919876543210",
        reason="Follow up on 5G plan",
        previous_call_id=prev_call_id,
        caller_name="Rahul",
    )

    assert result["success"] is True
    assert "callback_id" in result
    assert result["was_adjusted"] is False

    # Verify persisted in callbacks table
    async with db.session_factory() as session:
        stmt = sa.select(CallbackRequest).where(CallbackRequest.id == result["callback_id"])
        cb = (await session.execute(stmt)).scalar_one_or_none()
        assert cb is not None
        assert cb.phone_number == "+919876543210"
        assert cb.previous_call_id == prev_call_id
        assert "Rahul was busy" in (cb.context_summary or "")
        assert cb.status == "pending"
        assert cb.max_attempts == 3


@pytest.mark.asyncio
async def test_callback_scheduler_execution_and_max_attempts():
    db = get_db()
    await db.init_db()

    # Schedule a callback due immediately
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
    async with db.session_factory() as session:
        cb = CallbackRequest(
            caller_name="Pooja Sharma",
            phone_number="+919822334455",
            scheduled_time=now_utc,
            timezone="Asia/Kolkata",
            reason="Inquire credit card annual fee waiver",
            context_summary="Customer requested callback about credit card charges.",
            status="pending",
            attempts=0,
            max_attempts=MAX_CALLBACK_ATTEMPTS,
        )
        session.add(cb)
        await session.commit()
        cb_id = cb.id

    # Mock engine to simulate call connection
    dispatched_variables = {}

    class MockTelephonyEngine:
        async def start_outbound_call(self, to_number: str, variables=None, **kwargs) -> str:
            nonlocal dispatched_variables
            dispatched_variables = variables or {}
            return f"call_cb_{int(time.time())}"

    scheduler = CallbackScheduler(engine=MockTelephonyEngine())
    executed_count = await scheduler.process_due_callbacks()
    assert executed_count == 1

    # Verify context handoff in prompt variables
    assert dispatched_variables.get("is_callback") is True
    assert "credit card charges" in dispatched_variables.get("previous_call_summary", "")
    assert "[SYSTEM CALLBACK NOTE]" in dispatched_variables.get("callback_context_injection", "")

    # Verify status completed in database
    async with db.session_factory() as session:
        stmt = sa.select(CallbackRequest).where(CallbackRequest.id == cb_id)
        cb_after = (await session.execute(stmt)).scalar_one()
        assert cb_after.status == "completed"
        assert cb_after.attempts == 1
        assert cb_after.completed_at is not None
