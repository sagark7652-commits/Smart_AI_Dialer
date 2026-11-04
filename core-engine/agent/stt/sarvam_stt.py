"""Sarvam AI Speech-To-Text (STT) implementation.

Official API Endpoint:
POST https://api.sarvam.ai/speech-to-text
Headers: api-subscription-key: <SARVAM_API_KEY>
Supported models: saaras:v1, saaras:v2
Supported Indian languages: hi-IN, mr-IN, en-IN, etc.
"""

import asyncio
import io
import time
from typing import AsyncIterator, Optional
import wave
import httpx
from agent.config import get_settings
from agent.logger import setup_logger
from agent.stt.base import BaseSTT, TranscriptionEvent

logger = setup_logger("stt.sarvam")


class SarvamSTT(BaseSTT):
    """Sarvam AI Speech-to-Text provider."""

    API_URL = "https://api.sarvam.ai/speech-to-text"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "saaras:v2",
        sample_rate: int = 16000,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.sarvam_api_key
        self.model = model
        self.sample_rate = sample_rate
        self.language_code = "unknown"
        self._audio_buffer = bytearray()
        self._events_queue: asyncio.Queue[TranscriptionEvent] = asyncio.Queue()
        self._is_running = False

    async def start(self, language: Optional[str] = None) -> None:
        """Prepare session for speech recognition."""
        if not self.api_key:
            logger.warning("SARVAM_API_KEY is not set. Sarvam STT will fail if invoked.")
        if language:
            code = language.split("-")[0].lower()
            mapping = {"hi": "hi-IN", "mr": "mr-IN", "en": "en-IN"}
            self.language_code = mapping.get(code, "unknown")
        else:
            self.language_code = "unknown"
        self._is_running = True
        self._audio_buffer.clear()
        logger.info(f"Sarvam STT initialized (Model: {self.model}, Lang: {self.language_code})")

    async def stop(self) -> None:
        """Flush remaining buffer and close session."""
        self._is_running = False
        self._audio_buffer.clear()

    async def send_audio(self, audio_chunk: bytes) -> None:
        """Accumulate raw PCM audio chunks."""
        if self._is_running:
            self._audio_buffer.extend(audio_chunk)

    async def stream_events(self) -> AsyncIterator[TranscriptionEvent]:
        """Yield transcription events when available."""
        while self._is_running or not self._events_queue.empty():
            try:
                event = await asyncio.wait_for(self._events_queue.get(), timeout=0.1)
                yield event
                self._events_queue.task_done()
            except asyncio.TimeoutError:
                continue

    async def transcribe_wav_bytes(self, wav_bytes: bytes, language: Optional[str] = None) -> str:
        """Direct transcription of WAV audio using Sarvam REST API."""
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY environment variable is missing.")

        lang_code = self.language_code
        if language:
            code = language.split("-")[0].lower()
            lang_code = {"hi": "hi-IN", "mr": "mr-IN", "en": "en-IN"}.get(code, "unknown")

        headers = {"api-subscription-key": self.api_key}
        files = {
            "file": ("audio.wav", wav_bytes, "audio/wav"),
        }
        data = {
            "model": self.model,
            "language_code": lang_code,
            "with_diarization": "false",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(self.API_URL, headers=headers, files=files, data=data)
            if resp.status_code != 200:
                logger.error(f"Sarvam STT API error ({resp.status_code}): {resp.text}")
                resp.raise_for_status()
            res_json = resp.json()
            return res_json.get("transcript", "").strip()
