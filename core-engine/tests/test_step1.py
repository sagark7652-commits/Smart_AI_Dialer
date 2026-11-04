"""Tests for Step 1 setup, interfaces, and language registry."""

import pytest
from typing import AsyncIterator, List, Optional, Union
from agent.config import get_settings, Settings
from agent.languages import get_language, SUPPORTED_LANGUAGES, LanguageConfig
from agent.telephony.base import BaseTelephonyProvider
from agent.stt.base import BaseSTT, TranscriptionEvent
from agent.llm.base import BaseLLM, ChatMessage
from agent.tts.base import BaseTTS
from agent.pipeline import VoicePipeline


def test_settings_load():
    """Verify settings load with expected defaults."""
    settings = get_settings()
    assert isinstance(settings, Settings)
    assert settings.stt_provider in ["deepgram", "sarvam"]
    assert settings.llm_provider in ["groq", "gemini", "openai"]
    assert settings.tts_provider in ["cartesia", "sarvam", "elevenlabs"]
    assert settings.telephony_provider in ["twilio", "exotel"]


def test_languages_registry():
    """Verify Hindi, Marathi, and English are present and resolvable."""
    assert "en" in SUPPORTED_LANGUAGES
    assert "hi" in SUPPORTED_LANGUAGES
    assert "mr" in SUPPORTED_LANGUAGES

    # Test aliases
    assert get_language("hindi").short_code == "hi"
    assert get_language("hinglish").short_code == "hi"
    assert get_language("marathi").short_code == "mr"
    assert get_language("english").short_code == "en"
    assert get_language("unknown_lang") is None


def test_telephony_interface_contract():
    """Verify telephony interface can be implemented and subclassed."""

    class MockTelephony(BaseTelephonyProvider):
        async def make_call(self, to_number: str, from_number: Optional[str] = None, webhook_url: Optional[str] = None) -> str:
            return "call-123"

        async def hangup(self, call_id: str) -> None:
            pass

        async def audio_in(self) -> AsyncIterator[bytes]:
            yield b"dummy_audio"

        async def audio_out(self, audio_data: bytes) -> None:
            pass

        async def clear_audio(self) -> None:
            pass

    provider = MockTelephony()
    assert isinstance(provider, BaseTelephonyProvider)


def test_stt_interface_contract():
    """Verify STT interface contract."""

    class MockSTT(BaseSTT):
        async def start(self, language: Optional[str] = None) -> None:
            pass

        async def stop(self) -> None:
            pass

        async def send_audio(self, audio_chunk: bytes) -> None:
            pass

        async def stream_events(self) -> AsyncIterator[TranscriptionEvent]:
            yield TranscriptionEvent(text="namaste", is_final=True)

    stt = MockSTT()
    assert isinstance(stt, BaseSTT)


def test_llm_interface_contract():
    """Verify LLM interface contract."""

    class MockLLM(BaseLLM):
        async def generate_stream(self, messages: List[ChatMessage], system_prompt: Optional[str] = None) -> AsyncIterator[str]:
            yield "Hello"

    llm = MockLLM()
    assert isinstance(llm, BaseLLM)


def test_tts_interface_contract():
    """Verify TTS interface contract."""

    class MockTTS(BaseTTS):
        async def generate_audio_stream(self, text_stream: Union[AsyncIterator[str], str], language: Optional[str] = None) -> AsyncIterator[bytes]:
            yield b"\x00\x01"

    tts = MockTTS()
    assert isinstance(tts, BaseTTS)


def test_pipeline_initialization():
    """Verify pipeline initialization with base contracts."""
    pipeline = VoicePipeline()
    assert pipeline is not None
