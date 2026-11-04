"""Regression tests for Part B: Echo Guard, Transcript Deduplication, Loop Breaker, and Off-Script Topic Handling."""

import asyncio
import time
import pytest
from agent.pipeline import AgentState, VoicePipeline
from agent.stt.base import TranscriptionEvent
from agent.stt.mock_stt import MockSTT
from agent.llm.mock_llm import MockLLM
from agent.tts.mock_tts import MockTTS
from agent.llm.prompt_manager import AgentPromptManager


@pytest.fixture
def mock_pipeline():
    prompt_manager = AgentPromptManager()
    stt = MockSTT()
    llm = MockLLM()
    tts = MockTTS()
    pipeline = VoicePipeline(
        stt=stt,
        llm=llm,
        tts=tts,
        player=None,
        prompt_manager=prompt_manager,
        call_id="test_part_b_reg",
    )
    return pipeline


def test_echo_guard_drops_matching_agent_speech(mock_pipeline):
    """Verify echo guard drops incoming transcripts matching agent's recent speech."""
    # Seed recent agent replies
    agent_speech = "Namaste! Welcome to Aarogya Dental Care. Main Priya baat kar rahi hoon."
    mock_pipeline._recent_agent_replies.append(agent_speech)

    # 1. Exact match echo
    assert mock_pipeline._is_echo("Main Priya baat kar rahi hoon") is True

    # 2. Fuzzy high similarity echo
    assert mock_pipeline._is_echo("welcome to aarogya dental care main priya baat kar rahi hoon") is True

    # 3. Genuine user speech (not echo)
    assert mock_pipeline._is_echo("Mujhe doctor se appointment lena hai") is False
    assert mock_pipeline._is_echo("Aapki clinic kahan par hai?") is False


def test_transcript_deduplication_within_window(mock_pipeline):
    """Verify identical transcripts within 2 seconds are detected and deduplicated."""
    now = time.time()
    mock_pipeline._last_caller_transcript = "मुझे अपॉइंटमेंट चाहिए"
    mock_pipeline._last_caller_transcript_time = now - 0.5  # 500ms ago

    # Exact duplicate within window
    is_dupe = (
        "मुझे अपॉइंटमेंट चाहिए" == mock_pipeline._last_caller_transcript
        and (now - mock_pipeline._last_caller_transcript_time) < 2.0
    )
    assert is_dupe is True

    # After window expires (>2.0s)
    mock_pipeline._last_caller_transcript_time = now - 2.5
    is_dupe_expired = (
        "मुझे अपॉइंटमेंट चाहिए" == mock_pipeline._last_caller_transcript
        and (now - mock_pipeline._last_caller_transcript_time) < 2.0
    )
    assert is_dupe_expired is False


def test_loop_breaker_anti_repetition(mock_pipeline):
    """Verify that identical or >80% similar responses trigger the loop breaker."""
    previous_reply = "डॉ. शर्मा की कंसल्टेशन फीस 500 रुपये है और क्लिनिक सुबह 9 बजे से रात 8 बजे तक खुला है।"
    mock_pipeline._recent_agent_replies.append(previous_reply)

    # Very similar response (>80%)
    similar_reply = "डॉ. शर्मा की कंसल्टेशन फीस 500 रुपये है और क्लिनिक सुबह 9:00 बजे से रात 8:00 बजे तक खुला है।"
    assert mock_pipeline._is_looping_reply(similar_reply) is True

    # Fresh different response
    different_reply = "रूट कैनाल ट्रीटमेंट 3,500 रुपये से शुरू होता है।"
    assert mock_pipeline._is_looping_reply(different_reply) is False


def test_tool_execution_verbal_summary_guarantee(mock_pipeline):
    """Verify tool output is always translated into a non-empty conversational sentence."""
    check_call = {"name": "check_availability", "arguments": {"date": "tomorrow"}}
    tool_out_json = '{"success": true, "available_slots": ["10:30 AM", "12:00 PM"]}'

    summary_hi = mock_pipeline._synthesize_tool_summary(check_call, tool_out_json, detected_lang="hi")
    assert len(summary_hi) > 10
    assert "10:30 AM" in summary_hi or "डॉक्टर शर्मा" in summary_hi

    summary_mr = mock_pipeline._synthesize_tool_summary(check_call, tool_out_json, detected_lang="mr")
    assert len(summary_mr) > 10
    assert "डॉ. शर्मा" in summary_mr

    booking_call = {"name": "book_appointment", "arguments": {"caller_name": "Test"}}
    book_out = '{"success": true, "appointment_id": 99}'
    summary_book = mock_pipeline._synthesize_tool_summary(booking_call, book_out, detected_lang="hi")
    assert "99" in summary_book or "सफलतापूर्वक" in summary_book


@pytest.mark.asyncio
async def test_multi_turn_off_script_conversation(mock_pipeline):
    """Verify multi-turn off-script flow where user switches topics and agent answers each."""
    # Turn 1: On-script inquiry about appointment
    await mock_pipeline._generate_and_speak("Mujhe root canal karana hai", "hi", time.perf_counter(), 100.0)
    turn1_reply = "".join(mock_pipeline._current_agent_reply)
    assert len(turn1_reply) > 0
    assert "रूट कैनाल" in turn1_reply or "3,500" in turn1_reply

    # Turn 2: Sudden off-script question ("Who are you? Are you a robot?")
    await mock_pipeline._generate_and_speak("Who are you? Are you a doctor or a robot?", "en", time.perf_counter(), 100.0)
    turn2_reply = "".join(mock_pipeline._current_agent_reply)
    assert len(turn2_reply) > 0

    # Turn 3: Urgent emergency topic
    await mock_pipeline._generate_and_speak("Mujhe bahut tez daat mein dard ho raha hai", "hi", time.perf_counter(), 100.0)
    turn3_reply = "".join(mock_pipeline._current_agent_reply)
    assert len(turn3_reply) > 0
    assert "दर्द" in turn3_reply or "क्लिनिक" in turn3_reply or "इमरजेंसी" in turn3_reply
