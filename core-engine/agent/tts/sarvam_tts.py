"""Sarvam AI Bulbul TTS implementation for Hindi, Marathi, and English."""

import base64
from typing import AsyncIterator, Optional, Union
import httpx
from agent.config import get_settings
from agent.tts.base import BaseTTS
from agent.tts.normalizer import TextNormalizer
from agent.logger import setup_logger

logger = setup_logger("tts.sarvam")


class SarvamTTS(BaseTTS):
    """Text-To-Speech implementation using Sarvam AI Bulbul for native Indic speech."""

    API_URL = "https://api.sarvam.ai/text-to-speech"
    DEFAULT_SPEAKER = "leher"
    VOICES = {
        "female": "leher",
        "male": "neer",
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        speaker: Optional[str] = None,
        model: Optional[str] = None,
        gender: str = "female",
        sample_rate: int = 22050,
        pace: float = 1.05,
        pitch: float = 0.0,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.sarvam_api_key
        self.model = model or getattr(settings, "sarvam_model", "bulbul:v3")
        self.pace = pace
        self.pitch = pitch
        if speaker:
            self.speaker = speaker
        else:
            self.speaker = self.VOICES.get(gender.lower(), self.DEFAULT_SPEAKER)
        self.sample_rate = sample_rate

        if not self.api_key:
            logger.warning("SARVAM_API_KEY is not set. SarvamTTS will fail if called without a key.")

    def _resolve_language_code(self, language: Optional[str]) -> str:
        lang = (language or "hi").lower()
        if "mr" in lang:
            return "mr-IN"
        if "en" in lang:
            return "en-IN"
        return "hi-IN"

    async def generate_audio_stream(
        self,
        text_or_stream: Union[AsyncIterator[str], str],
        language: Optional[str] = "en",
    ) -> AsyncIterator[bytes]:
        """Synthesize text into WAV audio using Sarvam AI."""
        if not self.api_key:
            raise ValueError(
                "SARVAM_API_KEY is missing. Please set it in your .env file or environment."
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

        target_lang = self._resolve_language_code(language)

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": [normalized_text],
            "target_language_code": target_lang,
            "speaker": self.speaker,
            "pitch": self.pitch,
            "pace": self.pace,
            "loudness": 1.5,
            "speech_sample_rate": self.sample_rate,
            "enable_preprocessing": True,
            "model": self.model,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(self.API_URL, headers=headers, json=payload)
            if response.status_code != 200:
                logger.error(f"Sarvam API error: {response.status_code} - {response.text}")
                response.raise_for_status()

            data = response.json()
            audios = data.get("audios", [])
            for b64_audio in audios:
                audio_bytes = base64.b64decode(b64_audio)
                yield audio_bytes
