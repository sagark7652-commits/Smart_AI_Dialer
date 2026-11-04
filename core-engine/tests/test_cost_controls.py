"""Tests for Item 7: Financial Cost Controls, Budget Enforcement & Usage Reporting."""
import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from agent.db import DatabaseManager, APIKeyModel, CampaignModel, UsageRecord
from agent.cost_controller import CostController, USD_TO_INR
from agent.pipeline import VoicePipeline, AgentState
from agent.webhooks.dispatcher import WebhookDispatcher


@pytest.fixture
def test_db():
    import uuid
    import os
    db_file = f"test_cost_{uuid.uuid4().hex[:8]}.db"
    db = DatabaseManager(db_url=f"sqlite:///{db_file}")
    yield db
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_api_key_hard_stop_at_100_percent(test_db):
    """Test that reaching 100% of daily call limit blocks new calls with clear reason."""
    await test_db.init_db()
    controller = CostController(db=test_db)

    # 1. Create API key with daily limit of 5 calls
    async with test_db.session_factory() as session:
        key = APIKeyModel(
            name="Test Client",
            key_hash="dummy_hash_1",
            prefix="ca_live_test1",
            daily_max_calls=5,
            daily_max_minutes=60.0,
            daily_max_cost_usd=10.0,
        )
        session.add(key)
        await session.commit()
        key_id = key.id

    # 2. Record 4 calls today -> 80% warning
    for i in range(4):
        await test_db.record_usage(
            call_id=f"call_{i}",
            call_duration_sec=60.0,
            stt_seconds=20.0,
            llm_prompt_tokens=100,
            llm_completion_tokens=50,
            tts_characters=200,
            estimated_cost_usd=0.05,
            api_key_id=key_id,
        )

    allowed, block_reason, warning = await controller.check_api_key_limits(key_id)
    assert allowed is True
    assert block_reason is None
    assert warning is not None
    assert warning["metric"] == "daily_calls"
    assert warning["percentage"] == 80.0

    # 3. Record 5th call today -> 100% limit reached
    await test_db.record_usage(
        call_id="call_5",
        call_duration_sec=60.0,
        stt_seconds=20.0,
        llm_prompt_tokens=100,
        llm_completion_tokens=50,
        tts_characters=200,
        estimated_cost_usd=0.05,
        api_key_id=key_id,
    )

    allowed, block_reason, _ = await controller.check_api_key_limits(key_id)
    assert allowed is False
    assert "Daily call limit reached (5/5)" in block_reason


@pytest.mark.asyncio
async def test_campaign_budget_hard_stop_and_80_percent_alert(test_db):
    """Test that campaign triggers alert at 80% and halts new dialing at 100%."""
    await test_db.init_db()
    controller = CostController(db=test_db)

    camp_id = "camp_test_budget"
    campaign = await test_db.create_campaign(
        campaign_id=camp_id,
        name="Budget Test Promo",
        agent_id="test_agent",
        contacts=["+919876543210"],
        budget_usd=1.0,  # $1.00 budget
        budget_inr=83.0,
    )

    # 1. Record usage at $0.85 -> >80% warning alert
    await test_db.record_usage(
        call_id="camp_call_1",
        call_duration_sec=300.0,
        stt_seconds=100.0,
        llm_prompt_tokens=500,
        llm_completion_tokens=250,
        tts_characters=1000,
        estimated_cost_usd=0.85,
        campaign_id=camp_id,
    )

    allowed, block_reason, warning = await controller.check_campaign_budget(camp_id)
    assert allowed is True
    assert block_reason is None
    assert warning is not None
    assert warning["percentage"] == 85.0
    assert warning["cost_usd"] == 0.85

    # 2. Record additional usage pushing total to $1.05 -> Hard stop at 100%
    await test_db.record_usage(
        call_id="camp_call_2",
        call_duration_sec=120.0,
        stt_seconds=40.0,
        llm_prompt_tokens=200,
        llm_completion_tokens=100,
        tts_characters=400,
        estimated_cost_usd=0.20,
        campaign_id=camp_id,
    )

    allowed, block_reason, _ = await controller.check_campaign_budget(camp_id)
    assert allowed is False
    assert "Campaign budget reached" in block_reason


@pytest.mark.asyncio
async def test_detailed_usage_breakdowns(test_db):
    """Test GET /usage returns summary and breakdowns by provider, mode, and day."""
    await test_db.init_db()

    # Record usage for twilio and exotel across different modes
    await test_db.record_usage(
        call_id="c_tw_1",
        call_duration_sec=120.0,
        stt_seconds=40.0,
        llm_prompt_tokens=300,
        llm_completion_tokens=150,
        tts_characters=600,
        estimated_cost_usd=0.08,
        provider="twilio",
        agent_mode="mobile_recharge_promo",
        campaign_id="camp_101",
    )
    await test_db.record_usage(
        call_id="c_exo_1",
        call_duration_sec=180.0,
        stt_seconds=60.0,
        llm_prompt_tokens=400,
        llm_completion_tokens=200,
        tts_characters=800,
        estimated_cost_usd=0.12,
        provider="exotel",
        agent_mode="clinic_booking",
        campaign_id="camp_101",
    )

    report = await test_db.get_detailed_usage(campaign_id="camp_101")

    # Check summary
    summary = report["summary"]
    assert summary["total_calls"] == 2
    assert summary["total_duration_minutes"] == 5.0
    assert summary["total_estimated_cost_usd"] == 0.20
    assert round(summary["total_estimated_cost_inr"], 2) == round(0.20 * 83.0, 2)

    # Check provider breakdown
    providers = report["breakdown_by_provider"]
    assert "twilio" in providers
    assert providers["twilio"]["calls"] == 1
    assert providers["twilio"]["minutes"] == 2.0
    assert "exotel" in providers
    assert providers["exotel"]["calls"] == 1
    assert providers["exotel"]["minutes"] == 3.0

    # Check mode breakdown
    modes = report["breakdown_by_mode"]
    assert "mobile_recharge_promo" in modes
    assert modes["mobile_recharge_promo"]["calls"] == 1
    assert "clinic_booking" in modes
    assert modes["clinic_booking"]["calls"] == 1

    # Check day breakdown
    days = report["breakdown_by_day"]
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    assert today_str in days
    assert days[today_str]["calls"] == 2


@pytest.mark.asyncio
async def test_pipeline_per_call_cost_guard_graceful_closure():
    """Test pipeline graceful exit when per-call max duration or cost limit is reached."""
    spoken_farewell = []

    async def fake_speak(phrase, language="en"):
        spoken_farewell.append(phrase)

    pipeline = VoicePipeline(
        call_id="test_cost_pipeline",
        loop_config={
            "max_call_duration_sec": 0.05,  # 50ms for instant trigger
            "max_call_cost_usd": 0.001,
        },
    )
    pipeline._speak_phrase = fake_speak

    # Simulate single chunk generator that takes longer than 50ms
    async def slow_audio_stream():
        await asyncio.sleep(0.08)
        yield b"\x00" * 320

    await pipeline.run_loop(slow_audio_stream())

    assert pipeline.end_reason == "max_duration_exceeded"
    assert pipeline.state == AgentState.DISCONNECTED
    assert len(spoken_farewell) > 0
    assert "समाप्त" in spoken_farewell[0] or "reached its duration limit" in spoken_farewell[0]
