"""Factory to instantiate the configured STT provider."""

from typing import Optional
from agent.config import get_settings
from agent.stt.base import BaseSTT
from agent.stt.deepgram_stt import DeepgramSTT
from agent.stt.sarvam_stt import SarvamSTT


def get_stt_provider(provider_name: Optional[str] = None) -> BaseSTT:
    """Instantiate and return the configured STT engine."""
    settings = get_settings()
    provider = (provider_name or settings.stt_provider).lower()

    if provider == "sarvam":
        return SarvamSTT()
    return DeepgramSTT()
