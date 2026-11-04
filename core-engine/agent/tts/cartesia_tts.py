"""Cartesia streaming TTS implementation with natural emotion and Indian English locale."""

from typing import AsyncIterator, Optional, Union
from cartesia import AsyncCartesia
from agent.config import get_settings
from agent.tts.base import BaseTTS
from agent.tts.normalizer import TextNormalizer
from agent.logger import setup_logger

logger = setup_logger("tts.cartesia")


class CartesiaTTS(BaseTTS):
    """Low-latency streaming Text-To-Speech using Cartesia Sonic Multilingual / 3.6."""

    DEFAULT_VOICE_ID = "a1e4199c-8c88-4608-8491-33da880e63b8"
    DEFAULT_MODEL_ID = "sonic-3.6"
    SAMPLE_RATE = 24000

    def __init__(
        self,
        api_key: Optional[str] = None,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
        sample_rate: int = 24000,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.cartesia_api_key
        self.voice_id = voice_id or settings.cartesia_voice_id or self.DEFAULT_VOICE_ID
        self.model_id = model_id or getattr(settings, "cartesia_model_id", self.DEFAULT_MODEL_ID)
        self.sample_rate = sample_rate

        if not self.api_key:
            logger.warning(
                "CARTESIA_API_KEY is not set. CartesiaTTS will fail if called without an active key."
            )
            self.client: Optional[AsyncCartesia] = None
        else:
            self.client = AsyncCartesia(api_key=self.api_key)

    async def generate_audio_stream(
        self,
        text_or_stream: Union[AsyncIterator[str], str],
        language: Optional[str] = "en",
    ) -> AsyncIterator[bytes]:
        """Synthesize normalized text into streaming 16-bit PCM audio chunks."""
        if not self.client:
            raise ValueError(
                "CARTESIA_API_KEY is missing. Please set it in your .env file or environment."
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

        lang_code = (language or "en").lower()

        call_kwargs = {
            "model_id": self.model_id,
            "transcript": normalized_text,
            "voice": {"mode": "id", "id": self.voice_id},
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": self.sample_rate,
            },
        }

        # Accurate multilingual routing for Cartesia Sonic 3.6
        if "mr" in lang_code:
            call_kwargs["language"] = "mr"
        elif "hi" in lang_code:
            call_kwargs["language"] = "hi"
        else:
            call_kwargs["locale"] = "en-IN"

        try:
            res = await self.client.tts.generate(**call_kwargs)
            frame_size = 2048
            async for chunk in res.iter_bytes(chunk_size=frame_size):
                if chunk:
                    yield chunk
        except Exception as e:
            logger.error(f"Cartesia generate API error for lang '{lang_code}': {e}")
