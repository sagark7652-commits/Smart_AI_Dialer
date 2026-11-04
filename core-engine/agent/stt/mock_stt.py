"""Mock streaming STT implementation for local interactive testing and evaluation."""

import asyncio
import time
from typing import AsyncIterator, Optional
from agent.logger import setup_logger
from agent.stt.base import BaseSTT, TranscriptionEvent

logger = setup_logger("stt.mock")


class MockSTT(BaseSTT):
    """Streaming STT that accepts pushed text from browser Web Speech or simulated audio."""

    def __init__(self, sample_rate: int = 16000) -> None:
        self.sample_rate = sample_rate
        self._event_queue: asyncio.Queue[TranscriptionEvent] = asyncio.Queue()
        self._is_active = False

    async def start(self, language: Optional[str] = "multi") -> None:
        """Start the mock STT session."""
        self._is_active = True
        logger.info(f"MockSTT started (lang={language}). Ready to receive speech/text.")

    async def stop(self) -> None:
        """Stop the mock STT session."""
        self._is_active = False
        logger.info("MockSTT stopped.")

    def set_language(self, language: str) -> None:
        """Dynamically update language hints."""
        self.language = language
        logger.info(f"MockSTT language hints updated to: {language}")

    async def send_audio(self, audio_chunk: bytes) -> None:
        """Process incoming audio frames."""
        pass

    async def push_text(
        self,
        text: str,
        is_final: bool = True,
        language: Optional[str] = None,
        latency_ms: float = 120.0,
    ) -> None:
        """Inject transcribed text directly into the pipeline."""
        if not self._is_active:
            return
        event = TranscriptionEvent(
            text=text,
            is_final=is_final,
            confidence=0.98,
            language=language,
            latency_ms=latency_ms,
        )
        await self._event_queue.put(event)

    async def stream_events(self) -> AsyncIterator[TranscriptionEvent]:
        """Yield transcription events."""
        while self._is_active or not self._event_queue.empty():
            try:
                event = await asyncio.wait_for(self._event_queue.get(), timeout=0.2)
                yield event
                self._event_queue.task_done()
            except asyncio.TimeoutError:
                continue
