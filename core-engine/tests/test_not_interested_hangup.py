"""Unit and integration tests for Caller Disinterest / Graceful Hangup Workflow."""

import asyncio
import pytest
from agent.safety import NotInterestedDetector
from agent.pipeline import AgentState, VoicePipeline
from agent.llm.prompt_manager import AgentPromptManager, ConversationSession
from unittest.mock import AsyncMock


def test_not_interested_detector_positives():
    """Verify various phrasing in English, Hindi, Hinglish and Marathi are detected accurately."""
    positive_samples = [
        "not interested",
        "I am not interested",
        "no interest at all",
        "no thanks",
        "no thank you",
        "don't want this",
        "cut the call",
        "please disconnect",
        "i'm busy right now",
        "nahi chahiye",
        "mujhe kuch nahi chahiye",
        "mujhe kuch nahi puchna",
        "mujhe kuch nahi poochna",
        "kuch nahi puchna",
        "nothing to ask",
        "no questions",
        "nahi lena hai",
        "phone kato",
        "call cut karo",
        "phone rakho",
        "call kaat do",
        "baat nahi karni",
        "abhi busy hoon",
        "nahi",
        "no",
        "na",
        "nako",
        "नको",
        "नाही पाहिजे",
        "फोन ठेवा",
        "कॉल कट करा",
        "मुझे कुछ नहीं पूछना",
        "कुछ नहीं पूछना",
        "कुछ नहीं जानना",
        "ना",
    ]
    for text in positive_samples:
        assert NotInterestedDetector.is_not_interested(text), f"Failed to detect: '{text}'"


def test_not_interested_detector_negatives():
    """Verify interested queries and questions are NOT falsely flagged as not interested."""
    negative_samples = [
        "haan batao kya plan hai",
        "yes I am interested in 5G",
        "what is the price of this recharge",
        "mujhko credit card chahiye",
        "doctor sharma ki fees kitni hai",
        "how can I apply?",
        "tell me more about benefits",
        "okay continue",
    ]
    for text in negative_samples:
        assert not NotInterestedDetector.is_not_interested(text), f"False positive on: '{text}'"


@pytest.mark.asyncio
async def test_pipeline_hangup_on_not_interested_hindi():
    """Verify pipeline speaks polite farewell and hangs up immediately when caller declines in Hindi."""
    mock_telephony = AsyncMock()
    mock_telephony.hangup = AsyncMock()

    cfg = {
        "name": "Simran",
        "company": {"name": "SwiftTel"},
        "default_language": "hi",
        "gender": "female",
    }
    pm = AgentPromptManager(config_dict=cfg)
    session = ConversationSession(prompt_manager=pm)

    pipeline = VoicePipeline(
        stt=AsyncMock(),
        llm=AsyncMock(),
        tts=AsyncMock(),
        telephony=mock_telephony,
        prompt_manager=pm,
    )
    pipeline.session = session
    pipeline.current_language = "hi"
    pipeline._speak_phrase = AsyncMock()

    # Caller says they are not interested
    await pipeline.process_user_turn("nahi chahiye call cut kardo")
    if pipeline._current_generation_task:
        await pipeline._current_generation_task

    # Verify agent state is DISCONNECTED
    assert pipeline.state == AgentState.DISCONNECTED
    # Verify telephony hangup was called
    mock_telephony.hangup.assert_called_once()
    # Verify polite farewell was spoken in Hindi / Hinglish
    pipeline._speak_phrase.assert_called_once()
    spoken_farewell = pipeline._speak_phrase.call_args[0][0]
    assert "thank you" in spoken_farewell.lower() or "koi baat nahi" in spoken_farewell.lower() or "धन्यवाद" in spoken_farewell
    # Verify outcome is marked
    assert session.call_outcome == "not_interested"


@pytest.mark.asyncio
async def test_pipeline_hangup_on_not_interested_english():
    """Verify pipeline speaks polite English farewell and disconnects when caller is not interested."""
    mock_telephony = AsyncMock()
    mock_telephony.hangup = AsyncMock()

    cfg = {
        "name": "Simran",
        "company": {"name": "SwiftTel"},
        "default_language": "en",
        "gender": "female",
    }
    pm = AgentPromptManager(config_dict=cfg)
    session = ConversationSession(prompt_manager=pm)

    pipeline = VoicePipeline(
        stt=AsyncMock(),
        llm=AsyncMock(),
        tts=AsyncMock(),
        telephony=mock_telephony,
        prompt_manager=pm,
    )
    pipeline.session = session
    pipeline.current_language = "en"
    pipeline.language_locked = True
    pipeline._speak_phrase = AsyncMock()

    await pipeline.process_user_turn("I am not interested, thank you")
    if pipeline._current_generation_task:
        await pipeline._current_generation_task

    assert pipeline.state == AgentState.DISCONNECTED
    mock_telephony.hangup.assert_called_once()
    pipeline._speak_phrase.assert_called_once()
    spoken_farewell = pipeline._speak_phrase.call_args[0][0]
    assert "thank you" in spoken_farewell.lower()
    assert session.call_outcome == "not_interested"


@pytest.mark.asyncio
async def test_pipeline_hangup_on_mujhe_kuch_nahi_puchna_no_silence_reprompt():
    """Verify 'mujhe kuch nahi puchna' immediately hangs up and suppresses silence reprompts."""
    mock_telephony = AsyncMock()
    mock_telephony.hangup = AsyncMock()

    cfg = {
        "name": "Priya",
        "company": {"name": "Aarogya Clinic"},
        "default_language": "hi",
        "gender": "female",
    }
    pm = AgentPromptManager(config_dict=cfg)
    session = ConversationSession(prompt_manager=pm)

    pipeline = VoicePipeline(
        stt=AsyncMock(),
        llm=AsyncMock(),
        tts=AsyncMock(),
        telephony=mock_telephony,
        prompt_manager=pm,
    )
    pipeline.session = session
    pipeline.current_language = "hi"
    pipeline._speak_phrase = AsyncMock()

    # Caller says "mujhe kuch nahi puchna"
    await pipeline.process_user_turn("mujhe kuch nahi puchna")
    if pipeline._current_generation_task:
        await pipeline._current_generation_task

    # 1. State must be DISCONNECTED
    assert pipeline.state == AgentState.DISCONNECTED
    mock_telephony.hangup.assert_called_once()
    assert session.call_outcome == "not_interested"

    # 2. Silence timeout check must return True (break) and NEVER prompt user
    pipeline._last_user_activity_time = 0  # force silence expiry
    silence_handled = await pipeline._handle_silence_timeout()
    assert silence_handled is True
    # Verify no additional phrases (like "क्या आप वहां हैं?") were spoken
    assert pipeline._speak_phrase.call_count == 1

