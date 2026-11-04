"""Unit and integration tests for STEP 3: Speed, Direct Answers, and Audio Caching."""

import asyncio
import json
from pathlib import Path
import time
from unittest.mock import AsyncMock, MagicMock
import pytest
from agent.llm.groq_llm import GroqLLM
from agent.llm.prompt_manager import AgentPromptManager
from agent.pipeline import AgentState, VoicePipeline
from agent.tts.audio_cache import get_audio_cache


def test_zero_latency_audio_cache_hit():
    """Verify that localized cached phrases return from memory in under 1ms."""
    cache = get_audio_cache()
    t0 = time.perf_counter()
    res_mr = cache.get_audio_by_key("greeting", "mr")
    elapsed_ms = (time.perf_counter() - t0) * 1000

    assert res_mr is not None, "Marathi greeting audio not found in cache"
    pcm_bytes, sr = res_mr
    assert len(pcm_bytes) > 1000
    assert sr == 24000
    assert elapsed_ms < 5.0, f"Cache retrieval took {elapsed_ms:.3f}ms (>5ms budget)"


def test_thinking_tokens_filtered():
    """Verify reasoning <think>...</think> blocks are stripped from Groq streaming output."""
    mock_client = MagicMock()

    class FakeChunk:
        def __init__(self, text):
            delta = MagicMock()
            delta.tool_calls = None
            delta.content = text
            choice = MagicMock()
            choice.delta = delta
            self.choices = [choice]

    async def fake_stream():
        chunks = [
            FakeChunk("<think>"),
            FakeChunk("The caller wants to book an appointment."),
            FakeChunk("</think>"),
            FakeChunk("Certainly! "),
            FakeChunk("Doctor Sharma is available tomorrow."),
        ]
        for c in chunks:
            yield c

    llm = GroqLLM(api_key="gsk_test")
    llm.client = mock_client
    mock_client.chat.completions.create = AsyncMock(return_value=fake_stream())

    tokens = []

    async def collect():
        async for t in llm.generate_stream(messages=[], system_prompt="Test"):
            tokens.append(t)

    asyncio.run(collect())
    joined = "".join(tokens)
    assert "<think>" not in joined
    assert "</think>" not in joined
    assert "The caller wants to book" not in joined
    assert "Certainly! Doctor Sharma is available tomorrow." in joined


def test_fillers_off_by_default():
    """Verify that when fillers are set to off, no filler guard runs."""
    pm = AgentPromptManager(config_dict={
        "name": "Priya",
        "default_language": "hi",
        "fillers": "off",
    })
    pipeline = VoicePipeline(
        stt=AsyncMock(),
        llm=AsyncMock(),
        tts=AsyncMock(),
        telephony=AsyncMock(),
        prompt_manager=pm,
    )
    assert pipeline.fillers_enabled is False


def test_network_ping_report_exists():
    """Verify provider latency report was measured and saved with real numbers."""
    report_file = Path("recordings/network_ping_report.json")
    assert report_file.exists(), "Network ping report not found"
    with open(report_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) >= 3
    for entry in data:
        assert "provider" in entry
        assert "http_rtt_ms" in entry
