"""Mock TTS implementation for local testing and zero-config browser speech fallback."""

import asyncio
from typing import AsyncIterator, Optional, Union
import numpy as np
from agent.logger import setup_logger
from agent.tts.base import BaseTTS
from agent.tts.normalizer import TextNormalizer

logger = setup_logger("tts.mock")


class MockTTS(BaseTTS):
    """Generates audio frames for mock testing, allowing browser Web Speech to speak text."""

    SAMPLE_RATE = 24000

    def __init__(self, sample_rate: int = 24000, gender: str = "female") -> None:
        self.sample_rate = sample_rate
        self.gender = gender.lower()
        self.current_language = "hi"
        self.active_voice = "leher" if self.gender == "female" else "neer"

    def set_language(self, language: str) -> None:
        lang_short = (language or "hi").split("-")[0].lower()
        self.current_language = lang_short
        if "en" in lang_short:
            self.active_voice = "sol" if self.gender == "female" else "ember"
        else:
            self.active_voice = "leher" if self.gender == "female" else "neer"
        logger.info(f"MockTTS language switched to '{lang_short}', active voice set to '{self.active_voice}'")

    def get_active_voice(self) -> str:
        return self.active_voice

    async def generate_audio_stream(
        self,
        text_or_stream: Union[AsyncIterator[str], str],
        language: Optional[str] = "hi",
    ) -> AsyncIterator[bytes]:
        """Yield PCM audio chunks for the given text."""
        if language:
            self.set_language(language)
        if isinstance(text_or_stream, str):
            text = text_or_stream
        else:
            chunks = []
            async for chunk in text_or_stream:
                chunks.append(chunk)
            text = "".join(chunks)

        normalized = TextNormalizer.normalize(text, language=language)
        if not normalized.strip():
            return

        # Generate a short soft 440Hz tone with 24kHz PCM so playback pipeline triggers cleanly
        # Duration proportional to text length (approx 40ms per word, min 250ms)
        word_count = max(1, len(normalized.split()))
        duration_sec = min(2.0, max(0.25, word_count * 0.05))
        t = np.linspace(0, duration_sec, int(self.sample_rate * duration_sec), False)
        # Soft tone amplitude
        tone = (np.sin(2 * np.pi * 320 * t) * 800).astype(np.int16)
        pcm_bytes = tone.tobytes()

        # Stream in 100ms chunks
        chunk_size = int(self.sample_rate * 0.1 * 2)  # 16-bit = 2 bytes per sample
        for i in range(0, len(pcm_bytes), chunk_size):
            yield pcm_bytes[i : i + chunk_size]
            await asyncio.sleep(0.02)

    def synthesize_pcm(self, text: str, language: Optional[str] = "hi") -> bytes:
        """Synchronously synthesize clean acoustic PCM bytes for a string."""
        normalized = TextNormalizer.normalize(text, language=language)
        word_count = max(1, len(normalized.split()))
        duration_sec = min(3.0, max(0.5, word_count * 0.08))
        t = np.linspace(0, duration_sec, int(self.sample_rate * duration_sec), False)
        tone = (np.sin(2 * np.pi * 320 * t) * 800).astype(np.int16)
        return tone.tobytes()
