"""Base interface for telephony providers (Twilio, Exotel, etc.)."""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional


class BaseTelephonyProvider(ABC):
    """Abstract base class for telephony providers."""

    @abstractmethod
    async def make_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ) -> str:
        """Initiate an outbound call and return the call identifier."""
        pass

    @abstractmethod
    async def hangup(self, call_id: str) -> None:
        """Terminate an active call."""
        pass

    @abstractmethod
    async def audio_in(self) -> AsyncIterator[bytes]:
        """Stream raw audio chunks received from the caller."""
        pass

    @abstractmethod
    async def audio_out(self, audio_data: bytes) -> None:
        """Send an audio chunk back to the caller."""
        pass

    @abstractmethod
    async def clear_audio(self) -> None:
        """Clear queued audio buffers to immediately stop playback (barge-in)."""
        pass

    async def transfer_call(self, call_id: str, destination: str) -> bool:
        """Transfer active call to a human operator, queue, or external number."""
        return False

    def set_dtmf_callback(self, callback) -> None:
        """Register callback for DTMF digit events."""
        self.dtmf_callback = callback
