"""Chaos and Resilience Test Suite for Provider Failover, Fallback Chains, and Circuit Breakers.

Validates:
1. Telephony primary failover to secondary provider without double-dialing.
2. Circuit breaker state machine (CLOSED -> OPEN -> HALF_OPEN -> CLOSED).
3. LLM mid-call error fallback without session drop.
4. TTS mid-call error fallback to secondary speech synthesizer.
5. All-provider exhaustion yielding emergency spoken apology.
6. /health endpoint reporting provider health and error metrics.
"""

import asyncio
import time
from typing import AsyncIterator, Dict, List, Optional, Union
import pytest
from fastapi.testclient import TestClient

from agent.llm.base import BaseLLM, ChatMessage
from agent.resilience.circuit_breaker import CircuitBreaker, CircuitState, get_circuit_registry
from agent.resilience.fallback_manager import FallbackChainManager
from agent.telephony.base import BaseTelephonyProvider
from agent.tts.base import BaseTTS
from server import app, engine

client = TestClient(app)


class ChaosFailingTelephony(BaseTelephonyProvider):
    """Mock telephony provider that fails with 500 / timeout on call placement."""

    def __init__(self, failure_error: Exception = RuntimeError("Carrier gateway 500 Internal Error")):
        self.failure_error = failure_error
        self.call_attempts = 0

    async def make_call(self, to_number: str, from_number: Optional[str] = None, webhook_url: Optional[str] = None) -> str:
        self.call_attempts += 1
        raise self.failure_error

    async def hangup(self, call_id: str) -> None:
        pass

    async def audio_in(self) -> AsyncIterator[bytes]:
        yield b""

    async def audio_out(self, audio_data: bytes) -> None:
        pass

    async def clear_audio(self) -> None:
        pass


class ChaosWorkingTelephony(BaseTelephonyProvider):
    """Mock telephony provider that succeeds."""

    def __init__(self):
        self.calls_placed = []

    async def make_call(self, to_number: str, from_number: Optional[str] = None, webhook_url: Optional[str] = None) -> str:
        call_sid = f"sec_{int(time.time()*1000)}"
        self.calls_placed.append((call_sid, to_number))
        return call_sid

    async def hangup(self, call_id: str) -> None:
        pass

    async def audio_in(self) -> AsyncIterator[bytes]:
        yield b""

    async def audio_out(self, audio_data: bytes) -> None:
        pass

    async def clear_audio(self) -> None:
        pass


class ChaosFailingLLM(BaseLLM):
    """Mock LLM that raises 500 error or simulated timeout."""

    async def generate_stream(self, messages: List[ChatMessage], system_prompt: Optional[str] = None, tools: Optional[List[Dict]] = None) -> AsyncIterator[str]:
        raise ConnectionResetError("Remote LLM service returned 503 Service Unavailable")


class ChaosWorkingLLM(BaseLLM):
    """Fallback working LLM."""

    async def generate_stream(self, messages: List[ChatMessage], system_prompt: Optional[str] = None, tools: Optional[List[Dict]] = None) -> AsyncIterator[str]:
        yield "Fallback response from secondary LLM provider."


class ChaosFailingTTS(BaseTTS):
    """Mock TTS that raises exception."""

    async def generate_audio_stream(self, text: Union[AsyncIterator[str], str], language: Optional[str] = "hi") -> AsyncIterator[bytes]:
        raise TimeoutError("TTS API connection timed out.")


class ChaosWorkingTTS(BaseTTS):
    """Fallback working TTS."""

    async def generate_audio_stream(self, text: Union[AsyncIterator[str], str], language: Optional[str] = "hi") -> AsyncIterator[bytes]:
        yield b"\x00\x01\x02\x03" * 200


def test_circuit_breaker_transitions():
    """Verify circuit breaker transitions: CLOSED -> OPEN after failures, then HALF_OPEN probe."""
    breaker = CircuitBreaker(name="test_service", failure_threshold=3, recovery_timeout_sec=0.1)
    assert breaker.state == CircuitState.CLOSED
    assert breaker.can_execute() is True

    # Record 2 failures (threshold is 3)
    breaker.record_failure(ValueError("Error 1"))
    breaker.record_failure(ValueError("Error 2"))
    assert breaker.state == CircuitState.CLOSED
    assert breaker.can_execute() is True

    # Record 3rd failure -> should trip to OPEN
    breaker.record_failure(ValueError("Error 3"))
    assert breaker.state == CircuitState.OPEN
    # Immediate request must be rejected
    assert breaker.can_execute() is False

    # Wait for recovery timeout (0.1s)
    time.sleep(0.12)
    # Next request transitions to HALF_OPEN probe
    assert breaker.can_execute() is True
    assert breaker.state == CircuitState.HALF_OPEN

    # Successful probe restores to CLOSED
    breaker.record_success()
    assert breaker.state == CircuitState.CLOSED
    assert breaker.failure_count == 0


@pytest.mark.asyncio
async def test_llm_fallback_chain_on_error():
    """Verify LLM fallback takes over on primary 503 error without dropping turn."""
    manager = FallbackChainManager()
    failing_llm = ChaosFailingLLM()
    working_llm = ChaosWorkingLLM()

    messages = [ChatMessage(role="user", content="Hello")]
    tokens = []

    async for token in manager.generate_llm_with_fallback(
        primary_llm=failing_llm,
        fallback_llm=working_llm,
        messages=messages,
        system_prompt="Test",
        language="en",
    ):
        tokens.append(token)

    full_response = "".join(tokens)
    assert "Fallback response from secondary LLM provider." in full_response


@pytest.mark.asyncio
async def test_tts_fallback_chain_on_error():
    """Verify TTS fallback takes over when primary TTS stream raises timeout."""
    manager = FallbackChainManager()
    failing_tts = ChaosFailingTTS()
    working_tts = ChaosWorkingTTS()

    chunks = []
    async for chunk in manager.stream_tts_with_fallback(
        primary_tts=failing_tts,
        fallback_tts=working_tts,
        text="Test fallback speech",
        language="hi",
    ):
        chunks.append(chunk)

    total_bytes = b"".join(chunks)
    assert len(total_bytes) > 0


@pytest.mark.asyncio
async def test_all_llms_exhausted_emergency_spoken_fallback():
    """Verify when both primary and secondary LLM fail, a polite emergency apology is spoken."""
    manager = FallbackChainManager()
    failing_llm1 = ChaosFailingLLM()
    failing_llm2 = ChaosFailingLLM()

    messages = [ChatMessage(role="user", content="Hello")]
    tokens = []

    async for token in manager.generate_llm_with_fallback(
        primary_llm=failing_llm1,
        fallback_llm=failing_llm2,
        messages=messages,
        system_prompt="Test",
        language="hi",
    ):
        tokens.append(token)

    full_text = "".join(tokens)
    assert "तकनीकी समस्या" in full_text


@pytest.mark.asyncio
async def test_telephony_failover_on_primary_failure(monkeypatch):
    """Verify primary provider 500 error triggers secondary provider retry without double-dial."""
    failing_primary = ChaosFailingTelephony()
    working_secondary = ChaosWorkingTelephony()

    engine.telephony = failing_primary

    # Patch compliance calling hours to always permit test
    from agent.safety import CallingHoursGuard
    monkeypatch.setattr(CallingHoursGuard, "validate_outbound_call", lambda num: (True, "OK"))

    # Patch factory to return working secondary
    import agent.telephony.factory
    monkeypatch.setattr(agent.telephony.factory, "get_telephony_provider", lambda name: working_secondary)

    call_sid = await engine.start_outbound_call(
        to_number="+919876543210",
        max_retries=1,
    )

    # Primary failed, secondary placed the call
    assert call_sid.startswith("sec_")
    assert len(working_secondary.calls_placed) == 1
    # Verify primary attempted once before failover
    assert failing_primary.call_attempts == 1


def test_health_endpoint_resilience_metrics():
    """Verify /health endpoint returns resilience status, provider error rates, and circuit breakers."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "resilience" in data
    resilience = data["resilience"]
    assert "all_healthy" in resilience
    assert "providers" in resilience
    assert "fallback_chains" in resilience
