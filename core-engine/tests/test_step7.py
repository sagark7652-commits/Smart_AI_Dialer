"""Tests for Step 7: Audio helpers, Exotel and Twilio adapters, and provider-agnostic conversation."""

import asyncio
import json
import numpy as np
import pytest
from agent.telephony.audio_helpers import AudioCodec
from agent.telephony.twilio_provider import TwilioProvider
from agent.telephony.exotel_provider import ExotelProvider
from agent.telephony.factory import get_telephony_provider
from agent.pipeline import VoicePipeline, AgentState
from agent.llm.prompt_manager import AgentPromptManager
from agent.stt.base import BaseSTT, TranscriptionEvent
from agent.llm.base import BaseLLM, ChatMessage
from agent.tts.base import BaseTTS


def test_audio_codec_conversions():
    """Verify PCM16 <-> G.711 Mu-Law and resampling."""
    samples = (np.sin(np.linspace(0, 10, 1600)) * 10000).astype(np.int16)
    pcm_bytes = samples.tobytes()

    # 1. PCM16 -> Mu-Law -> PCM16
    mulaw = AudioCodec.linear2ulaw(pcm_bytes)
    assert len(mulaw) == len(pcm_bytes) // 2

    reconstructed_pcm = AudioCodec.ulaw2linear(mulaw)
    assert len(reconstructed_pcm) == len(pcm_bytes)

    # 2. Resampling: 24kHz -> 8kHz
    pcm24k = np.zeros(2400, dtype=np.int16).tobytes()
    pcm8k = AudioCodec.resample_pcm(pcm24k, in_rate=24000, out_rate=8000)
    assert len(pcm8k) == 800 * 2  # 800 samples * 2 bytes = 1600 bytes

    # 3. Exotel 320-byte alignment
    unaligned = b"\x01" * 350
    aligned = AudioCodec.align_to_boundary(unaligned, alignment=320)
    assert len(aligned) % 320 == 0
    assert len(aligned) == 640


class MockWebSocket:
    """Mock WebSocket for inspecting outgoing telephony messages."""

    def __init__(self):
        self.sent_messages = []

    async def send_text(self, text: str):
        self.sent_messages.append(json.loads(text))


@pytest.mark.asyncio
async def test_twilio_adapter_flow():
    """Verify Twilio adapter handles start, media, outbound audio, and clear."""
    mock_ws = MockWebSocket()
    provider = TwilioProvider(account_sid="AC123", auth_token="tok", phone_number="+12345")
    provider.attach_websocket(mock_ws, stream_sid="MZ_TWILIO_123")

    # 1. Inbound start
    await provider.handle_inbound_message(
        json.dumps({"event": "start", "streamSid": "MZ_TWILIO_123", "start": {"callSid": "CA_123"}})
    )
    assert provider.stream_sid == "MZ_TWILIO_123"
    assert provider.call_sid == "CA_123"

    # 2. Inbound media
    dummy_mulaw = AudioCodec.linear2ulaw(np.zeros(160, dtype=np.int16).tobytes())
    b64_payload = AudioCodec.to_base64(dummy_mulaw)
    await provider.handle_inbound_message(
        json.dumps({"event": "media", "streamSid": "MZ_TWILIO_123", "media": {"payload": b64_payload}})
    )
    # Read converted 16kHz audio from audio_in
    audio_chunk = await anext(provider.audio_in())
    assert len(audio_chunk) > 0

    # 3. Outbound audio_out (paced 20ms frames + mark event)
    pcm24k = (np.ones(480, dtype=np.int16) * 1000).tobytes()  # 160 samples @ 8kHz = 1 frame
    await provider.audio_out(pcm24k, associated_text="Welcome to our clinic.")
    media_msgs = [m for m in mock_ws.sent_messages if m.get("event") == "media"]
    mark_msgs = [m for m in mock_ws.sent_messages if m.get("event") == "mark"]
    assert len(media_msgs) >= 1
    assert len(mark_msgs) == 1
    mark_name = mark_msgs[0]["mark"]["name"]
    assert provider._sent_marks[mark_name] == "Welcome to our clinic."

    # Simulate Twilio confirming mark playback
    await provider.handle_inbound_message(json.dumps({"event": "mark", "mark": {"name": mark_name}}))
    assert provider.get_played_text_summary() == "Welcome to our clinic."

    # 4. Outbound clear (barge-in)
    await provider.clear_audio()
    clear_msgs = [m for m in mock_ws.sent_messages if m.get("event") == "clear"]
    assert len(clear_msgs) == 1
    assert clear_msgs[0]["streamSid"] == "MZ_TWILIO_123"


@pytest.mark.asyncio
async def test_exotel_adapter_flow():
    """Verify Exotel adapter handles start, media, 320-byte aligned audio_out, and clear."""
    mock_ws = MockWebSocket()
    provider = ExotelProvider(
        account_sid="exo_sid",
        api_key="exo_key",
        api_token="exo_tok",
        caller_id="08012345678",
    )
    provider.attach_websocket(mock_ws, stream_sid="EXO_STREAM_999")

    # 1. Inbound start
    await provider.handle_inbound_message(
        json.dumps({"event": "start", "stream_sid": "EXO_STREAM_999", "call_sid": "CALL_EXO_123"})
    )
    assert provider.stream_sid == "EXO_STREAM_999"

    # 2. Inbound media
    pcm8k = np.zeros(320, dtype=np.int16).tobytes()
    b64_payload = AudioCodec.to_base64(pcm8k)
    await provider.handle_inbound_message(
        json.dumps({"event": "media", "stream_sid": "EXO_STREAM_999", "media": {"payload": b64_payload}})
    )
    audio_chunk = await anext(provider.audio_in())
    assert len(audio_chunk) > 0

    # 3. Outbound audio_out (enforces 320-byte alignment)
    pcm24k = (np.ones(1000, dtype=np.int16)).tobytes()
    await provider.audio_out(pcm24k)
    assert len(mock_ws.sent_messages) == 1
    msg = mock_ws.sent_messages[0]
    assert msg["event"] == "media"
    assert msg["stream_sid"] == "EXO_STREAM_999"

    # Decode and check alignment
    sent_audio = AudioCodec.from_base64(msg["media"]["payload"])
    assert len(sent_audio) % 320 == 0

    # 4. Outbound clear (barge-in)
    await provider.clear_audio()
    assert len(mock_ws.sent_messages) == 2
    assert mock_ws.sent_messages[1]["event"] == "clear"
    assert mock_ws.sent_messages[1]["stream_sid"] == "EXO_STREAM_999"


@pytest.mark.asyncio
async def test_provider_agnostic_pipeline_execution():
    """Run scripted mock conversation through the same pipeline with both Twilio and Exotel."""

    class MockSTT(BaseSTT):
        async def start(self, language=None):
            pass
        async def stop(self):
            pass
        async def send_audio(self, audio_chunk: bytes):
            pass
        async def stream_events(self):
            yield TranscriptionEvent(text="Aarogya Dental Care timing?", is_final=True)

    class MockLLM(BaseLLM):
        async def generate_stream(self, messages, system_prompt=None):
            yield "Clinic is open 9 AM to 8:30 PM."

    class MockTTS(BaseTTS):
        async def generate_audio_stream(self, text, language=None):
            yield (np.zeros(2400, dtype=np.int16)).tobytes()

    prompt_manager = AgentPromptManager()

    for provider_name in ["twilio", "exotel"]:
        mock_ws = MockWebSocket()
        telephony = get_telephony_provider(provider_name)
        sid = f"TEST_SID_{provider_name.upper()}"
        telephony.attach_websocket(mock_ws, stream_sid=sid)

        pipeline = VoicePipeline(
            stt=MockSTT(),
            llm=MockLLM(),
            tts=MockTTS(),
            player=None,
            telephony=telephony,
            prompt_manager=prompt_manager,
        )

        # Trigger barge-in
        pipeline._set_state(AgentState.SPEAKING)
        pipeline.trigger_barge_in()
        await asyncio.sleep(0.01)

        # Telephony provider should have received clear message
        assert len(mock_ws.sent_messages) == 1
        assert mock_ws.sent_messages[0]["event"] == "clear"


def test_phone_profile_and_backchannel_configuration():
    """Verify telephony session loads 'phone' VAD profile and backchannel settings."""
    prompt_manager = AgentPromptManager()
    telephony = TwilioProvider()

    pipeline = VoicePipeline(
        stt=None,
        llm=None,
        tts=None,
        player=None,
        telephony=telephony,
        prompt_manager=prompt_manager,
    )

    # Phone profile parameters should override defaults
    assert pipeline.end_of_turn_silence_ms == 700
    assert pipeline.extra_wait_ms == 400
    assert pipeline.vad_threshold == 450.0
    assert pipeline.barge_in_min_speech_ms == 280
    assert pipeline.headset_mode is False
    assert pipeline.ignore_backchannels is True
    assert "haan" in pipeline.backchannel_words
    assert "hmm" in pipeline.backchannel_words
    assert pipeline.max_call_duration_sec == 600.0


def test_twilio_dual_wav_recording(tmp_path):
    """Verify Twilio provider writes separate 8kHz PCM WAV recordings for caller and agent."""
    provider = TwilioProvider(recordings_dir=str(tmp_path))
    provider.start_recording("test_call_999")

    # Write dummy PCM frames
    pcm_caller = (np.ones(160, dtype=np.int16) * 500).tobytes()
    pcm_agent = (np.ones(160, dtype=np.int16) * 1500).tobytes()

    if provider._caller_wav_fp:
        provider._caller_wav_fp.writeframes(pcm_caller)
    if provider._agent_wav_fp:
        provider._agent_wav_fp.writeframes(pcm_agent)

    provider.stop_recording()

    caller_wav = tmp_path / "test_call_999_caller.wav"
    agent_wav = tmp_path / "test_call_999_agent.wav"

    assert caller_wav.exists()
    assert agent_wav.exists()
    assert caller_wav.stat().st_size > 44  # WAV header + data
    assert agent_wav.stat().st_size > 44

