"""Base interface for agent tools and function calling."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseTool(ABC):
    """Abstract base class for all agent-callable tools."""

    name: str
    description: str
    parameters: Dict[str, Any]  # JSON schema for arguments

    @abstractmethod
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool logic asynchronously and return result dictionary."""
        pass

    def to_schema(self) -> Dict[str, Any]:
        """Return OpenAI/Groq function calling schema definition."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }
