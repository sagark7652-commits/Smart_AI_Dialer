"""Unit and integration tests for Part 6: Quality.

Covers:
- Natural Fillers & Delay Guard
- Mid-Call Language Auto-Switching
- Pronunciation Dictionary
- Post-Call Analysis & Entity Extraction
- Prompt Versioning & Rollback via API
- Evaluation Harness execution
"""

import asyncio
import json
import time
from typing import AsyncIterator, List, Optional
from fastapi.testclient import TestClient
import pytest
from agent.analytics import PostCallAnalyzer, VALID_OUTCOMES
from agent.auth import hash_key
from agent.db import get_db
from agent.engine import CallingAgentEngine
from agent.fillers import FillerManager, FILLER_PHRASES
from agent.languages import detect_language
from agent.llm.base import BaseLLM, ChatMessage
from agent.llm.prompt_manager import AgentPromptManager
from agent.pipeline import AgentState, VoicePipeline
from agent.tts.base import BaseTTS
from agent.tts.normalizer import TextNormalizer
from agent.tts.pronunciation import PronunciationManager, get_pronunciation_manager
from evals.scenarios import SCENARIOS
from eval_runner import run_evaluation_suite
from server import app


class DummyDelayedLLM(BaseLLM):
    """LLM mock with configurable delay to test filler trigger and cancellation."""

    def __init__(self, delay_sec: float = 0.0) -> None:
        self.delay_sec = delay_sec

    async def generate_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: str,
        tools: Optional[List[dict]] = None,
    ) -> AsyncIterator[str]:
        if self.delay_sec > 0:
            await asyncio.sleep(self.delay_sec)
        yield "Dr. Sharma is available tomorrow."


class DummyTTS(BaseTTS):
    """TTS mock recording synthesized chunks."""

    def __init__(self) -> None:
        self.spoken_phrases: List[str] = []

    async def generate_audio_stream(
        self, text: str, voice_id: Optional[str] = None, language: str = "hi"
    ) -> AsyncIterator[bytes]:
        self.spoken_phrases.append(text)
        yield b"\x00" * 320


# ============================================================================
# 1. FILLER MANAGER TESTS
# ============================================================================

def test_filler_manager_languages_and_categories():
    fm = FillerManager(default_language="hi", delay_threshold_ms=800)
    
    # Hindi thinking filler
    hi_filler = fm.get_filler(category="thinking", language="hi")
    assert any(hi_filler == p for p in FILLER_PHRASES["hi"]["thinking"])

    # English tool filler
    en_filler = fm.get_filler(category="tool", language="en")
    assert any(en_filler == p for p in FILLER_PHRASES["en"]["tool"])

    # Marathi acknowledgement filler
    mr_filler = fm.get_filler(category="acknowledgement", language="mr")
    assert any(mr_filler == p for p in FILLER_PHRASES["mr"]["acknowledgement"])


@pytest.mark.asyncio
async def test_filler_delay_guard_fires_on_slow_llm():
    """If LLM takes longer than filler_delay_ms, a thinking filler must be spoken."""
    slow_llm = DummyDelayedLLM(delay_sec=0.25)
    tts = DummyTTS()
    pm = AgentPromptManager()

    pipeline = VoicePipeline(
        llm=slow_llm,
        tts=tts,
        prompt_manager=pm,
        filler_delay_ms=80,  # 80ms delay threshold
    )
    pipeline.session.add_user_message("Can I book an appointment?")
    
    await pipeline._generate_and_speak(
        user_text="Can I book an appointment?",
        detected_lang="hi",
        speech_end_time=time.perf_counter(),
        stt_latency_ms=10.0,
    )

    # At least two phrases must have been passed to TTS: the filler and the LLM response
    assert len(tts.spoken_phrases) >= 2
    # Verify the first spoken phrase was one of the thinking fillers
    assert any(f in tts.spoken_phrases[0] for f in ["एक सेकंड", "देख रही हूँ", "रुकिए", "बिल्कुल"])


@pytest.mark.asyncio
async def test_filler_delay_guard_does_not_fire_on_fast_llm():
    """If LLM responds immediately, no filler should be spoken."""
    fast_llm = DummyDelayedLLM(delay_sec=0.0)
    tts = DummyTTS()
    pm = AgentPromptManager()

    pipeline = VoicePipeline(
        llm=fast_llm,
        tts=tts,
        prompt_manager=pm,
        filler_delay_ms=400,  # 400ms threshold
    )
    pipeline.session.add_user_message("Can I book an appointment?")

    await pipeline._generate_and_speak(
        user_text="Can I book an appointment?",
        detected_lang="hi",
        speech_end_time=time.perf_counter(),
        stt_latency_ms=10.0,
    )

    # Only 1 phrase (the LLM answer) spoken
    assert len(tts.spoken_phrases) == 1
    assert "Sharma" in tts.spoken_phrases[0]


# ============================================================================
# 2. MID-CALL LANGUAGE AUTO-SWITCHING TESTS
# ============================================================================

def test_language_detection_and_switch():
    en_query = "What time does your dental clinic open?"
    hi_query = "डॉक्टर शर्मा की फीस कितनी है?"
    mr_query = "मला उद्या सकाळी दहा वाजता डॉक्टरांना दाखवायचे आहे."

    assert detect_language(en_query).short_code == "en"
    assert detect_language(hi_query).short_code == "hi"
    assert detect_language(mr_query).short_code == "mr"


# ============================================================================
# 3. PRONUNCIATION DICTIONARY TESTS
# ============================================================================

def test_pronunciation_manager_substitutions():
    pm = get_pronunciation_manager()

    # Hindi substitution
    text_hi = "Dr. Sharma at Aarogya Dental Care for OPD and RCT."
    norm_hi = TextNormalizer.normalize(text_hi, language="hi")
    assert "डॉक्टर" in norm_hi
    assert "आरोग्य" in norm_hi
    assert "ओपीडी" in norm_hi
    assert "रूट कैनाल" in norm_hi

    # English substitution
    text_en = "Dr. Sharma at OPD for RCT."
    norm_en = TextNormalizer.normalize(text_en, language="en")
    assert "Doctor" in norm_en
    assert "O.P.D." in norm_en
    assert "Root Canal" in norm_en


# ============================================================================
# 4. POST-CALL ANALYSIS & ENTITY EXTRACTION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_post_call_analysis_fallback_and_db_persistence():
    db = get_db()
    await db.init_db()

    call_id = f"test_call_anal_{int(time.time() * 1000)}"
    await db.create_call(
        call_id=call_id,
        caller_number="+919876543210",
        direction="inbound",
        status="in-progress",
    )

    transcript = [
        {"speaker": "agent", "text": "Namaste! Welcome to Aarogya Dental Care."},
        {"speaker": "caller", "text": "I want to book an appointment with Dr. Sharma for tomorrow. My number is 9876543210."},
        {"speaker": "agent", "text": "Your appointment has been confirmed and booked successfully."},
    ]

    analyzer = PostCallAnalyzer(llm=DummyDelayedLLM())
    result = await analyzer.analyze_call(call_id=call_id, transcript_turns=transcript)

    assert result["outcome"] in VALID_OUTCOMES
    assert result["outcome"] == "booked"
    assert result["sentiment"] in ["positive", "neutral", "negative"]
    assert "summary" in result

    # Check persistence in database
    call = await db.get_call(call_id)
    assert call.outcome == "booked"
    assert call.summary is not None
    assert call.sentiment is not None


# ============================================================================
# 5. PROMPT VERSIONING & ROLLBACK TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_prompt_versioning_and_rollback_api():
    db = get_db()
    await db.init_db()

    # Create auth API key
    raw_key = f"ca_live_p6test_{int(time.time() * 1000)}"
    khash = hash_key(raw_key)
    await db.create_api_key(name="p6_test", key_hash=khash, prefix=raw_key[:12], rate_limit=100)
    headers = {"x-api-key": raw_key}

    client = TestClient(app)

    agent_id = f"test_agent_{int(time.time())}"
    create_payload = {
        "id": agent_id,
        "name": "Versioned Agent",
        "system_prompt": "You are a prompt version 1 assistant.",
        "greeting": "Greeting version 1",
    }
    res = client.post("/agents", json=create_payload, headers=headers)
    assert res.status_code == 201

    # Verify version 1 exists
    res_v = client.get(f"/agents/{agent_id}/versions", headers=headers)
    assert res_v.status_code == 200
    versions = res_v.json()
    assert len(versions) == 1
    assert versions[0]["version"] == 1
    assert versions[0]["system_prompt"] == "You are a prompt version 1 assistant."

    # Update to version 2
    update_payload = {
        "system_prompt": "You are a prompt version 2 assistant.",
        "greeting": "Greeting version 2",
    }
    res_up = client.put(f"/agents/{agent_id}", json=update_payload, headers=headers)
    assert res_up.status_code == 200

    # Verify version 2 is now listed
    res_v2 = client.get(f"/agents/{agent_id}/versions", headers=headers)
    assert len(res_v2.json()) == 2
    assert res_v2.json()[0]["version"] == 2

    # Roll back to version 1
    res_rb = client.post(
        f"/agents/{agent_id}/rollback",
        json={"version": 1},
        headers=headers,
    )
    assert res_rb.status_code == 200
    rb_data = res_rb.json()
    assert rb_data["restored_version"] == 1
    assert rb_data["system_prompt"] == "You are a prompt version 1 assistant."
    assert rb_data["greeting"] == "Greeting version 1"

    # Verify latest agent profile has reverted
    res_get = client.get(f"/agents/{agent_id}", headers=headers)
    assert res_get.json()["system_prompt"] == "You are a prompt version 1 assistant."


# ============================================================================
# 6. EVALUATION HARNESS TEST
# ============================================================================

@pytest.mark.asyncio
async def test_eval_runner_suite_sample():
    results = await run_evaluation_suite(limit=5, mock=True, output_file="eval_test_sample.json")
    assert len(results) == 5
    assert all(r.passed for r in results)
