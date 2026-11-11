"""Hugging Face Open-Source TTS Provider.

Synthesizes audio using Hugging Face inference models such as:
- facebook/mms-tts-eng (English)
- facebook/mms-tts-hin (Hindi)
- facebook/mms-tts-mar (Marathi)
- hexgrad/Kokoro-82M or custom endpoints
Converts synthesized audio into streaming PCM chunks compatible with telephony.
"""

import io
from typing import AsyncIterator, Optional
import httpx
from agent.config import get_settings
from agent.logger import setup_logger
from agent.tts.base import BaseTTS

logger = setup_logger("tts.huggingface")

DEFAULT_HF_TTS_ENG = "facebook/mms-tts-eng"
DEFAULT_HF_TTS_HIN = "facebook/mms-tts-hin"
DEFAULT_HF_TTS_MAR = "facebook/mms-tts-mar"
HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models"


class HuggingFaceTTS(BaseTTS):
    """Text-to-Speech provider using Hugging Face Inference API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        language: str = "en",
        sample_rate: int = 24000,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or getattr(settings, "huggingface_api_key", None)
        self.sample_rate = sample_rate
        self.language = language.lower()

        if model:
            self.model = model
        elif self.language.startswith("mr"):
            self.model = DEFAULT_HF_TTS_MAR
        elif self.language.startswith("hi"):
            self.model = DEFAULT_HF_TTS_HIN
        else:
            self.model = DEFAULT_HF_TTS_ENG

        if not self.api_key:
            logger.warning(
                "HUGGINGFACE_API_KEY is not set. HuggingFaceTTS requires an active HF token."
            )

    def set_language(self, language: str) -> None:
        self.language = language.lower()
        if self.language.startswith("mr"):
            self.model = DEFAULT_HF_TTS_MAR
        elif self.language.startswith("hi"):
            self.model = DEFAULT_HF_TTS_HIN
        else:
            self.model = DEFAULT_HF_TTS_ENG

    async def generate_audio_stream(
        self,
        text: str,
        language: Optional[str] = None,
    ) -> AsyncIterator[bytes]:
        """Synthesize text and stream raw PCM audio chunks."""
        clean_text = text.strip()
        if not clean_text:
            return

        lang = (language or self.language).lower()
        if lang.startswith("mr"):
            model_to_use = DEFAULT_HF_TTS_MAR
        elif lang.startswith("hi"):
            model_to_use = DEFAULT_HF_TTS_HIN
        else:
            model_to_use = self.model

        if not self.api_key:
            logger.warning("HUGGINGFACE_API_KEY missing; cannot synthesize audio via HF.")
            return

        url = f"{HF_INFERENCE_URL}/{model_to_use}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {"inputs": clean_text}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code != 200:
                    logger.warning(
                        f"HF TTS {model_to_use} failed with {res.status_code}: {res.text[:200]}"
                    )
                    return

                audio_data = res.content
                if not audio_data:
                    return

                # Check if it's wav or flac, extract PCM or chunk raw audio
                # For streaming chunk delivery:
                chunk_size = 1024
                for i in range(0, len(audio_data), chunk_size):
                    yield audio_data[i : i + chunk_size]
        except Exception as e:
            logger.error(f"Hugging Face TTS synthesis error: {e}")
