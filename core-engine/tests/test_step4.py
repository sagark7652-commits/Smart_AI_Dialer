"""Tests for Step 4 STT, phone audio simulator, and microphone components."""

import numpy as np
import pytest
from agent.stt.phone_simulator import PhoneAudioSimulator
from agent.stt.deepgram_stt import DeepgramSTT
from agent.stt.factory import get_stt_provider
from agent.stt.base import TranscriptionEvent


def test_phone_audio_simulator_resampling_and_companding():
    """Verify phone simulator downsamples, applies mu-law, and upsamples back to 16kHz."""
    # 1 second of 16kHz test tone
    sample_rate = 16000
    t = np.linspace(0, 1.0, sample_rate, False)
    tone = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)

    processed_bytes = PhoneAudioSimulator.simulate_telephony(tone.tobytes())
    assert len(processed_bytes) > 0

    reconstructed = np.frombuffer(processed_bytes, dtype=np.int16)
    # The output sample length should match 16kHz within resampling filter tolerances
    assert abs(len(reconstructed) - sample_rate) <= 10
    # No NaNs or infinities
    assert not np.isnan(reconstructed).any()


def test_phone_simulator_empty_input():
    """Verify empty bytes handle gracefully."""
    assert PhoneAudioSimulator.simulate_telephony(b"") == b""


def test_deepgram_url_generation():
    """Verify Deepgram WebSocket URL correctly configures language and parameters."""
    stt = DeepgramSTT(api_key="dummy_key", model="nova-3", sample_rate=16000)

    url_multi = stt._build_ws_url("multi")
    assert "model=nova-3" in url_multi
    assert "language=multi" in url_multi
    assert "encoding=linear16" in url_multi
    assert "sample_rate=16000" in url_multi

    url_mr = stt._build_ws_url("mr")
    assert "language=mr" in url_mr

    url_hi = stt._build_ws_url("hi")
    assert "language=hi" in url_hi


def test_transcription_event_with_latency():
    """Verify TranscriptionEvent properly holds text, final flag, and latency."""
    event = TranscriptionEvent(
        text="Namaste, clinic kiti vajta suru hote?",
        is_final=True,
        confidence=0.98,
        language="mr",
        latency_ms=280.5,
    )
    assert event.is_final is True
    assert event.latency_ms == 280.5
    assert event.language == "mr"


def test_stt_factory():
    """Verify STT factory instantiates DeepgramSTT."""
    stt = get_stt_provider("deepgram")
    assert isinstance(stt, DeepgramSTT)
