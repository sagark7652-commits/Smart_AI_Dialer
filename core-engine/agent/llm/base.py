"""Base interface for Large Language Model (LLM) providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, List, Optional


@dataclass
class ChatMessage:
    """Represents a single message in a conversation thread."""

    role: str  # 'system', 'user', or 'assistant'
    content: str


class BaseLLM(ABC):
    """Abstract base class for streaming LLM generation."""

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """Stream generated text tokens for the conversation context."""
        pass
