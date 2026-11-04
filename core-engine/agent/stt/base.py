"""Base interface for Speech-To-Text (STT) providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Optional


@dataclass(frozen=True)
class TranscriptionEvent:
    """Represents a speech recognition transcription fragment."""

    text: str
    is_final: bool = False
    confidence: float = 1.0
    language: Optional[str] = None
    latency_ms: Optional[float] = None



class BaseSTT(ABC):
    """Abstract base class for streaming Speech-to-Text providers."""

    @abstractmethod
    async def start(self, language: Optional[str] = None) -> None:
        """Initialize the real-time transcription stream connection."""
        pass

    @abstractmethod
    async def stop(self) -> None:
        """Close and clean up the transcription session."""
        pass

    @abstractmethod
    async def send_audio(self, audio_chunk: bytes) -> None:
        """Feed a raw PCM/mulaw audio frame into the recognition stream."""
        pass

    @abstractmethod
    async def stream_events(self) -> AsyncIterator[TranscriptionEvent]:
        """Yield transcription events (interim and final) as speech is processed."""
        pass
