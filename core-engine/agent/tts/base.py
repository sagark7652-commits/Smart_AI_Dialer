"""Base interface for Text-To-Speech (TTS) providers."""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional, Union


class BaseTTS(ABC):
    """Abstract base class for streaming Text-to-Speech synthesis."""

    @abstractmethod
    async def generate_audio_stream(
        self,
        text_stream: Union[AsyncIterator[str], str],
        language: Optional[str] = None,
    ) -> AsyncIterator[bytes]:
        """Synthesize text or a stream of text tokens into an audio byte stream."""
        pass
