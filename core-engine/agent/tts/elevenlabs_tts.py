"""ElevenLabs streaming TTS implementation with Instant Voice Cloning support."""

from typing import AsyncIterator, Optional, Union
import httpx
from agent.config import get_settings
from agent.tts.base import BaseTTS
from agent.tts.normalizer import TextNormalizer
from agent.logger import setup_logger

logger = setup_logger("tts.elevenlabs")


class ElevenLabsTTS(BaseTTS):
    """Low-latency streaming Text-To-Speech using ElevenLabs Flash v2.5 / Turbo v2.5."""

    DEFAULT_MODEL_ID = "eleven_flash_v2_5"  # Ultra-fast low latency (approx 75ms)
    SAMPLE_RATE = 24000

    def __init__(
        self,
        api_key: Optional[str] = None,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
        sample_rate: int = 24000,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.elevenlabs_api_key
        self.voice_id = voice_id or getattr(settings, "elevenlabs_voice_id", None) or "21m00Tcm4TlvDq8ikWAM"
        self.model_id = model_id or self.DEFAULT_MODEL_ID
        self.sample_rate = sample_rate

        if not self.api_key:
            logger.warning("ELEVENLABS_API_KEY is not set. ElevenLabsTTS will fail if called without an active key.")

    async def generate_audio_stream(
        self,
        text_or_stream: Union[AsyncIterator[str], str],
        language: Optional[str] = "en",
    ) -> AsyncIterator[bytes]:
        """Synthesize normalized text into streaming 16-bit 24kHz PCM audio chunks."""
        if not self.api_key:
            raise ValueError(
                "ELEVENLABS_API_KEY is missing. Please set it in your .env file or environment."
            )

        if hasattr(text_or_stream, "__aiter__"):
            collected = []
            async for token in text_or_stream:
                collected.append(token)
            raw_text = "".join(collected)
        else:
            raw_text = str(text_or_stream)

        normalized_text = TextNormalizer.normalize(raw_text, language=language)
        if not normalized_text.strip():
            return

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream"
        params = {"output_format": "pcm_24000"}
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": normalized_text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.85,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload, params=params) as response:
                if response.status_code != 200:
                    err = await response.aread()
                    logger.error(f"ElevenLabs TTS API error {response.status_code}: {err.decode('utf-8', errors='ignore')}")
                    return

                async for chunk in response.aiter_bytes(chunk_size=2048):
                    if chunk:
                        yield chunk
