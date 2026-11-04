"""Unit and integration tests for STEP 2: Strict Language Lock, Localized Prompts, and Speed."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
import pytest
from agent.languages import LanguageValidator, get_locale_manager
from agent.llm.prompt_manager import AgentPromptManager, ConversationSession
from agent.pipeline import AgentState, VoicePipeline


def test_runtime_language_validator_speed():
    """Verify runtime language validator executes well under the 10ms budget."""
    samples = [
        ("Hello! Welcome to Aarogya Dental Care. How can I help you today?", "en"),
        ("नमस्ते! आरोग्य डेंटल केयर में आपका स्वागत है।", "hi"),
        ("नमस्कार! आरोग्य डेंटल केअर मध्ये आपले स्वागत आहे. मी आपली काय मदत करू?", "mr"),
    ]
    for text, lang in samples:
        t0 = time.perf_counter()
        res = LanguageValidator.validate(text, lang)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        assert res.valid is True
        assert elapsed_ms < 10.0, f"Validator took {elapsed_ms:.2f}ms (>10ms budget)"


def test_language_validator_catches_violations():
    """Verify validator flags cross-language pollution accurately."""
    # 1. English selected but Hindi Devanagari replied
    res_en_violation = LanguageValidator.validate("नमस्ते! आपकी अपॉइंटमेंट कल के लिए बुक हो गई है।", "en")
    assert res_en_violation.valid is False
    assert "Devanagari" in res_en_violation.violation_reason

    # 2. English selected but Hinglish slang used
    res_en_hinglish = LanguageValidator.validate("Accha, I will book your appointment tomorrow ji.", "en")
    assert res_en_hinglish.valid is False
    assert "Hinglish" in res_en_hinglish.violation_reason

    # 3. Marathi selected but Hindi grammar markers used
    res_mr_violation = LanguageValidator.validate("नमस्ते! आप कैसे हैं? मुझे बात करनी है।", "mr")
    assert res_mr_violation.valid is False
    assert "Hindi grammatical markers" in res_mr_violation.violation_reason

    # 4. Marathi selected in Latin script instead of Devanagari
    res_mr_latin = LanguageValidator.validate("Namaskar! Tumchi appointment udya ahe.", "mr")
    assert res_mr_latin.valid is False
    assert "Devanagari" in res_mr_latin.violation_reason


def test_localized_fixed_lines():
    """Verify all three language locales (mr, hi, en) contain all essential keys."""
    lm = get_locale_manager()
    required_keys = [
        "greeting",
        "consent",
        "are_you_there",
        "silence_farewell",
        "goodbye",
        "not_interested",
        "transfer",
        "error_fallback",
        "callback_offer",
        "not_understood",
        "hold",
        "dnc_confirmed",
    ]
    for lang in ["mr", "hi", "en"]:
        for key in required_keys:
            line = lm.get_line(lang, key)
            assert line, f"Missing key '{key}' in locale '{lang}'"
            assert len(line.strip()) > 3


def test_prompt_manager_greetings_per_language():
    """Verify greeting changes appropriately according to configured language."""
    for lang, expected_greeting_start in [
        ("mr", "नमस्कार!"),
        ("hi", "नमस्ते!"),
        ("en", "Hello!"),
    ]:
        pm = AgentPromptManager(config_dict={
            "name": "Priya",
            "company_name": "Aarogya Dental Care",
            "mode": "clinic_booking",
            "default_language": lang,
            "language_policy": "strict",
        })
        greeting = pm.get_greeting()
        assert greeting.startswith(expected_greeting_start), (
            f"Language {lang} greeting '{greeting}' did not start with '{expected_greeting_start}'"
        )


@pytest.mark.asyncio
async def test_closing_signoff_immediate_hangup():
    """Verify that when agent gives a polite closing signoff, call immediately ends without silence reprompts."""
    mock_stt = AsyncMock()
    mock_llm = AsyncMock()
    mock_tts = AsyncMock()
    mock_telephony = AsyncMock()

    # LLM outputs a polite closing sign-off
    async def mock_llm_stream(*args, **kwargs):
        yield "जी कोई बात नहीं, अपना समय देने के लिए धन्यवाद। आपका दिन शुभ हो!"

    mock_llm.generate_stream = mock_llm_stream

    pm = AgentPromptManager(config_dict={
        "name": "Priya",
        "default_language": "hi",
        "language_policy": "strict",
        "mode": "clinic_booking",
    })
    pipeline = VoicePipeline(
        stt=mock_stt,
        llm=mock_llm,
        tts=mock_tts,
        telephony=mock_telephony,
        prompt_manager=pm,
        call_id="test_hangup_signoff",
    )
    pipeline._speak_phrase = AsyncMock()

    # Process user declining
    await pipeline.process_user_turn("मुझे कुछ नहीं पूछना")
    if pipeline._current_generation_task:
        await pipeline._current_generation_task

    # The pipeline should transition directly to DISCONNECTED
    assert pipeline.state == AgentState.DISCONNECTED
    mock_telephony.hangup.assert_awaited()

    # Silence timeout must return True immediately and speak nothing
    silence_result = await pipeline._handle_silence_timeout()
    assert silence_result is True
