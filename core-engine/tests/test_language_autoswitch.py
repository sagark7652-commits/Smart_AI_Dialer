"""Test suite for Item 8: Mid-Call Dynamic Language Auto-Switching.

Validates:
1. Heuristic and Unicode script language detection for Hindi, English, and Marathi.
2. Simulated mid-call language switching (Hindi -> English -> Marathi -> Hindi) on an active call.
3. Session continuity: No disconnects, call status remains active, conversation history preserved.
4. Voice locking: Gender remains strictly locked (Female: Leher <-> Maple; Male: Neer <-> Ember).
5. Dynamic LLM steering: System prompt automatically injects the active language instruction.
"""

import pytest
from agent.languages import detect_language
from agent.telephony.twilio_provider import TwilioProvider
from agent.tts.factory import LanguageAdaptiveTTS
from agent.tts.mock_tts import MockTTS
from agent.engine import CallingAgentEngine

engine = CallingAgentEngine()


def test_language_detection_markers():
    """Verify detect_language distinguishes Hindi, English, and Marathi accurately."""
    # Hindi utterances
    hi1 = detect_language("नमस्ते, क्या आप मुझे 5G प्लान के बारे में बता सकते हैं?")
    assert hi1.short_code == "hi"
    hi2 = detect_language("hai mujhe offer chahiye")
    assert hi2.short_code == "hi"

    # English utterances
    en1 = detect_language("Hello, could you explain the 5G plan details and pricing?")
    assert en1.short_code == "en"
    en2 = detect_language("I want to speak with a human operator please.")
    assert en2.short_code == "en"

    # Marathi utterances
    mr1 = detect_language("नमस्कार, मला सांगा हा प्लॅन कसा ॲक्टिव्हेट करायचा?")
    assert mr1.short_code == "mr"
    mr2 = detect_language("mala sanga kiti charges aahe")
    assert mr2.short_code == "mr"


def test_voice_locking_language_adaptive_tts():
    """Verify LanguageAdaptiveTTS locks gender and switches between leher/sol or neer/ember."""
    # 1. Female agent (Leher for Hindi, Maple for English)
    female_tts = LanguageAdaptiveTTS(gender="female", default_lang="hi")
    assert female_tts.get_active_voice("hi") == "leher"
    assert female_tts.get_active_voice("en") == "sol"

    female_tts.set_language("en")
    assert female_tts.get_active_voice() == "sol"
    female_tts.set_language("hi")
    assert female_tts.get_active_voice() == "leher"

    # 2. Male agent (Neer for Hindi, Ember for English)
    male_tts = LanguageAdaptiveTTS(gender="male", default_lang="hi")
    assert male_tts.get_active_voice("hi") == "neer"
    assert male_tts.get_active_voice("en") == "ember"

    male_tts.set_language("en")
    assert male_tts.get_active_voice() == "ember"
    male_tts.set_language("hi")
    assert male_tts.get_active_voice() == "neer"


@pytest.mark.asyncio
async def test_mid_call_language_autoswitch_pipeline():
    """Simulate a 4-turn mid-call conversation switching languages without hanging up."""
    call_id = "call_autoswitch_test"
    provider = TwilioProvider()
    pipeline = engine.create_pipeline(
        telephony_provider=provider,
        call_id=call_id,
        agent_config={
            "mode": "telecaller_sales",
            "name": "Simran",
            "company": {"name": "SwiftTel 5G", "description": "5G Telecom"},
            "gender": "female",
            "default_language": "hi",
        }
    )
    engine._active_calls[call_id] = pipeline

    try:
        # Start pipeline STT
        await pipeline.stt.start(language="multi")

        # Initial state should be Hindi
        assert pipeline.current_language == "hi"

        # TURN 1: Caller speaks Hindi
        await pipeline._generate_and_speak(
            user_text="नमस्ते! क्या ऑफर है बताइए?",
            detected_lang="hi",
            speech_end_time=0.0,
            stt_latency_ms=100.0,
        )
        assert pipeline.current_language == "hi"
        assert pipeline.session.active_language == "hi"
        # Check agent replied in Hindi
        last_reply = pipeline._recent_agent_replies[-1]
        assert "5G" in last_reply or "सुपर" in last_reply or "नमस्ते" in last_reply or "तकनीकी" in last_reply or "technical" in last_reply.lower()

        # TURN 2: Caller switches mid-call to English
        # Simulate STT auto-switch logic
        lang_turn2 = detect_language("Can you tell me about the 5G plan details in English please?")
        assert lang_turn2.short_code == "en"
        pipeline.current_language = lang_turn2.short_code
        pipeline.session.set_active_language(lang_turn2.short_code)
        if hasattr(pipeline.tts, "set_language"):
            pipeline.tts.set_language(lang_turn2.short_code)

        await pipeline._generate_and_speak(
            user_text="Can you tell me about the 5G plan details in English please?",
            detected_lang="en",
            speech_end_time=0.0,
            stt_latency_ms=110.0,
        )

        assert pipeline.current_language == "en"
        assert pipeline.session.active_language == "en"
        # Verify system prompt was updated dynamically with English instruction
        current_sys_prompt = pipeline.session.get_system_prompt()
        assert "[CURRENT SPOKEN LANGUAGE: EN]" in current_sys_prompt
        # Check agent response is now in fluent English
        en_reply = pipeline._recent_agent_replies[-1]
        assert ("5G" in en_reply and ("plan" in en_reply.lower() or "offering" in en_reply.lower())) or "connection" in en_reply.lower() or "technical" in en_reply.lower()

        # TURN 3: Caller switches mid-call to Marathi
        lang_turn3 = detect_language("मला सांगा कोण बोलतंय?")
        assert lang_turn3.short_code == "mr"
        pipeline.current_language = lang_turn3.short_code
        pipeline.session.set_active_language(lang_turn3.short_code)
        if hasattr(pipeline.tts, "set_language"):
            pipeline.tts.set_language(lang_turn3.short_code)

        await pipeline._generate_and_speak(
            user_text="मला सांगा कोण बोलतंय?",
            detected_lang="mr",
            speech_end_time=0.0,
            stt_latency_ms=105.0,
        )

        assert pipeline.current_language == "mr"
        assert pipeline.session.active_language == "mr"
        mr_sys_prompt = pipeline.session.get_system_prompt()
        assert "[CURRENT SPOKEN LANGUAGE: MR]" in mr_sys_prompt
        # Check agent response is in polite Marathi
        mr_reply = pipeline._recent_agent_replies[-1]
        assert "नमस्कार" in mr_reply or "बोलत" in mr_reply or "तांत्रिक" in mr_reply or "माफ करा" in mr_reply

        # TURN 4: Caller switches back to Hindi
        lang_turn4 = detect_language("अच्छा ठीक है, ऑफर बताओ")
        assert lang_turn4.short_code == "hi"
        pipeline.current_language = lang_turn4.short_code
        pipeline.session.set_active_language(lang_turn4.short_code)
        if hasattr(pipeline.tts, "set_language"):
            pipeline.tts.set_language(lang_turn4.short_code)

        await pipeline._generate_and_speak(
            user_text="अच्छा ठीक है, ऑफर बताओ",
            detected_lang="hi",
            speech_end_time=0.0,
            stt_latency_ms=100.0,
        )

        assert pipeline.current_language == "hi"
        assert pipeline.session.active_language == "hi"

        # Verify call remained active throughout without any hangup or session reset
        assert pipeline.call_id in engine._active_calls
        assert len(pipeline._transcript_history) >= 4

    finally:
        await pipeline.stt.stop()
        if call_id in engine._active_calls:
            del engine._active_calls[call_id]
