"""Tests for Step 5 & Day 1 Voice Loop: State machine, smart VAD, barge-in, silence handling, metrics."""

import json
from pathlib import Path
import time
import pytest
import numpy as np
from agent.pipeline import AgentState, VoicePipeline
from agent.stt.vad import VoiceActivityDetector
from agent.llm.prompt_manager import AgentPromptManager
from agent.tts.player import AudioPlayer


def test_vad_speech_and_silence_detection():
    """Verify VAD distinguishes speech energy from silence and detects end of turn."""
    vad = VoiceActivityDetector(rms_threshold=300.0, min_speech_ms=50, end_of_turn_silence_ms=200)

    # 1. Silence chunk (RMS < 300)
    silence = np.zeros(640, dtype=np.int16).tobytes()
    is_speaking, is_end, is_barge_in = vad.process_chunk(silence)
    assert not is_speaking
    assert not is_end
    assert not is_barge_in

    # 2. Loud tone (RMS > 300)
    loud_tone = (np.ones(640, dtype=np.int16) * 1500).tobytes()
    # Feed multiple chunks to exceed min_speech_ms
    for _ in range(5):
        is_speaking, is_end, is_barge_in = vad.process_chunk(loud_tone)
    assert is_speaking
    assert not is_end


def test_vad_smart_end_of_turn_conjunction():
    """Verify conjunctions at end of partial transcript trigger mid-sentence extra wait."""
    vad = VoiceActivityDetector()

    # With conjunctions
    assert vad.is_mid_sentence("I want to make an appointment and") is True
    assert vad.is_mid_sentence("Mujhe doctor se milna hai lekin") is True
    assert vad.is_mid_sentence("मला डॉक्टरांना भेटायचे आहे आणि") is True

    # With terminal punctuation
    assert vad.is_mid_sentence("I want to book an appointment.") is False
    assert vad.is_mid_sentence("Mujhe doctor se milna hai।") is False
    assert vad.is_mid_sentence("मला वेळ मिळेल का?") is False


def test_vad_prefix_padding_and_echo_guard():
    """Verify prefix ring buffer retains audio and echo guard raises threshold."""
    vad = VoiceActivityDetector(rms_threshold=300.0, headset_mode=False)

    chunk = (np.ones(400, dtype=np.int16) * 400).tobytes()
    vad.process_chunk(chunk)
    assert len(vad._prefix_buffer) > 0

    # With agent speaking and headset_mode=False, effective threshold is 300 * 1.85 = 555
    # A chunk with RMS 400 will be ignored
    is_speaking, _, _ = vad.process_chunk(chunk, is_agent_speaking=True)
    assert not is_speaking


def test_state_machine_transitions():
    """Verify pipeline state changes execute and fire callbacks."""
    prompt_manager = AgentPromptManager()
    player = AudioPlayer()
    try:
        pipeline = VoicePipeline(
            stt=None,
            llm=None,
            tts=None,
            player=player,
            prompt_manager=prompt_manager,
        )

        states_visited = []
        pipeline.on_state_change = lambda s: states_visited.append(s)

        pipeline._set_state(AgentState.LISTENING)
        pipeline._set_state(AgentState.THINKING)
        pipeline._set_state(AgentState.SPEAKING)

        assert pipeline.state == AgentState.SPEAKING
        assert states_visited == [
            AgentState.LISTENING,
            AgentState.THINKING,
            AgentState.SPEAKING,
        ]
    finally:
        player.close()


def test_barge_in_interruption_recording():
    """Verify barge-in halts speaking, clears playback, and flags message as interrupted."""
    prompt_manager = AgentPromptManager()
    player = AudioPlayer()
    try:
        pipeline = VoicePipeline(
            stt=None,
            llm=None,
            tts=None,
            player=player,
            prompt_manager=prompt_manager,
        )

        pipeline._set_state(AgentState.SPEAKING)
        pipeline._current_agent_reply = ["Root canal treatment starts at ₹3,500 and takes around "]

        # Trigger barge-in
        pipeline.trigger_barge_in()

        assert pipeline.state == AgentState.LISTENING
        assert pipeline._interrupted_turn is True
        assert pipeline._interruption_count == 1

        # Check conversation history has interrupted flag
        history = pipeline.session.get_history()
        last_msg = history[-1]
        assert "[Interrupted]" in last_msg.content
    finally:
        player.close()


@pytest.mark.asyncio
async def test_2_tier_silence_timeout_multilingual():
    """Verify 2-tier silence timeout handles reprompt and graceful goodbye in hi, en, mr."""
    prompt_manager = AgentPromptManager()
    player = AudioPlayer()
    try:
        for lang in ["hi", "en", "mr"]:
            pipeline = VoicePipeline(
                stt=None,
                llm=None,
                tts=None,
                player=player,
                prompt_manager=prompt_manager,
                silence_timeout_sec=0.01,
                second_silence_timeout_sec=0.01,
            )
            pipeline.current_language = lang
            pipeline._set_state(AgentState.LISTENING)
            pipeline._last_user_activity_time = time.time() - 0.05

            # Tier 1: Reprompt
            ended = await pipeline._handle_silence_timeout()
            assert not ended
            assert pipeline._silence_prompt_count == 1
            assert pipeline.state == AgentState.LISTENING

            # Tier 2: Farewell & Disconnect
            pipeline._last_user_activity_time = time.time() - 0.05
            ended = await pipeline._handle_silence_timeout()
            assert ended
            assert pipeline.state == AgentState.DISCONNECTED
    finally:
        player.close()


def test_transcript_and_metrics_file_saving(tmp_path: Path):
    """Verify transcripts and session metrics save correctly in JSON format."""
    prompt_manager = AgentPromptManager()
    player = AudioPlayer()
    try:
        pipeline = VoicePipeline(
            stt=None,
            llm=None,
            tts=None,
            player=player,
            prompt_manager=prompt_manager,
            transcripts_dir=str(tmp_path),
            call_id="call_test_metrics_123",
        )

        pipeline._record_transcript("caller", "Kya consultation fee hai?")
        pipeline._record_transcript(
            "agent",
            "Consultation fee ₹400 hai.",
            latency={
                "stt_ms": 150.0,
                "llm_ttft_ms": 320.0,
                "tts_first_chunk_ms": 180.0,
                "first_audio_ms": 650.0,
                "total_ms": 780.0,
            },
        )
        pipeline._all_latencies.append({
            "stt_ms": 150.0,
            "llm_ttft_ms": 320.0,
            "tts_first_chunk_ms": 180.0,
            "first_audio_ms": 650.0,
            "total_ms": 780.0,
        })

        saved_path = pipeline.save_session_transcript()
        assert saved_path.exists()

        with open(saved_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert len(data) == 2
        assert data[0]["role"] == "caller"
        assert data[1]["role"] == "agent"
        assert data[1]["latency_breakdown"]["total_ms"] == 780.0

        # Session summary & metrics file
        pipeline.print_session_summary()
        metrics_file = tmp_path / "metrics_call_test_metrics_123.json"
        assert metrics_file.exists()
        with open(metrics_file, "r", encoding="utf-8") as f:
            m_data = json.load(f)
        assert m_data["session_id"] == "call_test_metrics_123"
        assert m_data["total_turns"] == 1
        assert m_data["avg_latency_ms"] == 650.0
    finally:
        player.close()

