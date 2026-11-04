"""OpenAI Text-To-Speech implementation with ChatGPT voices (ember, sol)."""

from typing import AsyncIterator, Optional, Union
import httpx
from agent.config import get_settings
from agent.tts.base import BaseTTS
from agent.tts.normalizer import TextNormalizer
from agent.logger import setup_logger

logger = setup_logger("tts.openai")


class OpenAITTS(BaseTTS):
    """Text-To-Speech using OpenAI Audio Speech API with ChatGPT voices."""

    API_URL = "https://api.openai.com/v1/audio/speech"
    VOICES = {
        "female": "sol",
        "male": "ember",
    }
    DEFAULT_VOICE = "sol"

    def __init__(
        self,
        api_key: Optional[str] = None,
        voice: Optional[str] = None,
        gender: str = "female",
        model: str = "tts-1",
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.openai_api_key
        if voice:
            self.voice = voice
        else:
            self.voice = self.VOICES.get(gender.lower(), self.DEFAULT_VOICE)
        self.model = model

        if not self.api_key:
            logger.warning("OPENAI_API_KEY is not set. OpenAITTS will fail if called without an active key.")

    async def generate_audio_stream(
        self,
        text_or_stream: Union[AsyncIterator[str], str],
        language: Optional[str] = "en",
    ) -> AsyncIterator[bytes]:
        """Synthesize text into streaming audio chunks (PCM 16-bit 24kHz)."""
        if not self.api_key:
            raise ValueError(
                "OPENAI_API_KEY is missing. Please set it in your .env file or environment."
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

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "input": normalized_text,
            "voice": self.voice,
            "response_format": "pcm",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            async with client.stream("POST", self.API_URL, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_bytes = await response.aread()
                    error_msg = error_bytes.decode('utf-8', errors='ignore')
                    logger.error(f"OpenAI TTS API error: {response.status_code} - {error_msg}")
                    if "credit_balance_exhausted" in error_msg or "insufficient_quota" in error_msg:
                        logger.warning(
                            "OpenAI account has zero credit balance ($0). Please add billing credits at "
                            "https://platform.openai.com/settings/organization/billing/ to stream cloud Sol audio."
                        )
                    return

                async for chunk in response.aiter_bytes(chunk_size=2048):
                    if chunk:
                        yield chunk
