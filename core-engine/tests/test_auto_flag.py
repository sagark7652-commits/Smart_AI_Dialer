"""Tests for Item 6: Auto-Flagging of Bad / Anomaly Calls and Review Queue."""
import asyncio
import json
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from agent.analytics import PostCallAnalyzer
from agent.db import DatabaseManager, CallModel
from scripts.review_queue import print_review_queue


@pytest.fixture
def test_db():
    import uuid
    import os
    db_file = f"test_flags_{uuid.uuid4().hex[:8]}.db"
    db = DatabaseManager(db_url=f"sqlite:///{db_file}")
    yield db
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass


def test_compute_call_flags_comprehensive():
    """Verify all 11 anomaly conditions trigger the appropriate quality flags."""
    analyzer = PostCallAnalyzer()

    # 1. Loop detected
    turns_loop = [
        {"speaker": "agent", "text": "Namaste, main Aarogya Clinic se baat kar rahi hoon, kya main appointment book kar doon?"},
        {"speaker": "caller", "text": "Aap kaun ho?"},
        {"speaker": "agent", "text": "Namaste, main Aarogya Clinic se baat kar rahi hoon, kya main appointment book kar doon?"},
    ]
    flags = analyzer.compute_call_flags(transcript_turns=turns_loop, duration_sec=30.0)
    assert "loop_detected" in flags

    # 2. Many reprompts (>= 3)
    flags = analyzer.compute_call_flags(transcript_turns=[], duration_sec=30.0, silence_prompt_count=3)
    assert "many_reprompts" in flags

    # 3. Long silence (> 10s gap)
    turns_silence = [
        {"speaker": "agent", "text": "Hello?", "timestamp": "2026-10-29 10:00:00"},
        {"speaker": "caller", "text": "Yes I am here.", "timestamp": "2026-10-29 10:00:15"},  # 15s gap
    ]
    flags = analyzer.compute_call_flags(transcript_turns=turns_silence, duration_sec=30.0)
    assert "long_silence" in flags

    # 4. Low STT confidence (< 0.65)
    flags = analyzer.compute_call_flags(
        transcript_turns=[], duration_sec=30.0, stt_confidences=[0.92, 0.45]
    )
    assert "low_stt_confidence" in flags

    # 5. High latency turns (> 2500ms)
    latencies = [{"first_audio_ms": 2900.0}]
    flags = analyzer.compute_call_flags(
        transcript_turns=[], duration_sec=30.0, all_latencies=latencies
    )
    assert "high_latency_turns" in flags

    # 6. Caller hung up early (< 15s)
    turns_short = [{"speaker": "agent", "text": "Hello, SwiftTel se Simran bol rahi hoon"}]
    flags = analyzer.compute_call_flags(transcript_turns=turns_short, duration_sec=8.5)
    assert "caller_hung_up_early" in flags

    # 7. Tool error
    tool_results = [{"success": False, "error": "Database connection refused"}]
    flags = analyzer.compute_call_flags(
        transcript_turns=[], duration_sec=30.0, tool_results=tool_results
    )
    assert "tool_error" in flags

    # 8. Negative sentiment
    flags = analyzer.compute_call_flags(
        transcript_turns=[], duration_sec=30.0, sentiment="negative"
    )
    assert "negative_sentiment" in flags

    # 9. Transfer requested
    turns_transfer = [{"speaker": "caller", "text": "Mujhe kisi human agent se baat karni hai transfer karo"}]
    flags = analyzer.compute_call_flags(transcript_turns=turns_transfer, duration_sec=30.0)
    assert "transfer_requested" in flags

    # 10. Wrong language
    turns_wrong_lang = [{"speaker": "caller", "text": "Tamaru naam shu che tame kya thi bolo cho"}]  # Gujarati
    flags = analyzer.compute_call_flags(
        transcript_turns=turns_wrong_lang, duration_sec=30.0, configured_languages=["hi", "en", "mr"]
    )
    assert "wrong_language" in flags

    # 11. Injection attempt
    flags = analyzer.compute_call_flags(
        transcript_turns=[], duration_sec=30.0, injection_flags=["injection_attempt:ignore_rules"]
    )
    assert "injection_attempt:ignore_rules" in flags


@pytest.mark.asyncio
async def test_auto_flag_persistence_and_querying(test_db):
    """Test that flagged calls persist needs_review=True and can be queried via needs_review filter."""
    await test_db.init_db()

    # 1. Create a normal good call
    await test_db.create_call(
        call_id="call_good_1",
        caller_number="+919876543210",
        direction="outbound",
        provider="twilio",
    )
    await test_db.save_post_call_analysis(
        call_id="call_good_1",
        summary="Customer confirmed 5G recharge plan.",
        outcome="booked",
        sentiment="positive",
        needs_review=False,
        flag_reasons=[],
    )

    # 2. Create a bad call with anomalies
    await test_db.create_call(
        call_id="call_bad_1",
        caller_number="+919123456789",
        direction="outbound",
        provider="twilio",
    )
    await test_db.save_post_call_analysis(
        call_id="call_bad_1",
        summary="Caller was abusive and hung up after 5 seconds.",
        outcome="failed",
        sentiment="negative",
        needs_review=True,
        flag_reasons=["caller_hung_up_early", "negative_sentiment"],
    )

    # Query calls needing review
    review_calls = await test_db.list_calls(needs_review=True)
    assert len(review_calls) == 1
    assert review_calls[0].id == "call_bad_1"
    assert review_calls[0].needs_review is True
    flags = json.loads(review_calls[0].flag_reasons)
    assert "caller_hung_up_early" in flags
    assert "negative_sentiment" in flags

    # Query normal calls
    clean_calls = await test_db.list_calls(needs_review=False)
    assert len(clean_calls) == 1
    assert clean_calls[0].id == "call_good_1"
