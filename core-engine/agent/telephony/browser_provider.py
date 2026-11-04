"""Browser WebAudio provider for interactive browser testing via WebSockets."""

import asyncio
import base64
import json
from typing import AsyncIterator, Optional
from fastapi import WebSocket
from agent.logger import setup_logger
from agent.telephony.base import BaseTelephonyProvider

logger = setup_logger("telephony.browser")


class BrowserWebAudioProvider(BaseTelephonyProvider):
    """Telephony provider adapter for in-browser Google Chrome audio calls."""

    def __init__(self, websocket: WebSocket, call_id: str) -> None:
        self.websocket = websocket
        self.call_id = call_id
        self._is_active = True
        self._inbound_audio_queue: asyncio.Queue[bytes] = asyncio.Queue()

    async def make_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ) -> str:
        return self.call_id

    async def hangup(self, call_id: str, reason: str = "call_ended") -> None:
        self._is_active = False
        try:
            await self.websocket.send_text(json.dumps({"type": "hangup", "reason": reason}))
        except Exception:
            pass

    async def audio_in(self) -> AsyncIterator[bytes]:
        """Yield 16kHz PCM audio frames received from browser microphone."""
        while self._is_active:
            try:
                chunk = await asyncio.wait_for(self._inbound_audio_queue.get(), timeout=0.1)
                yield chunk
                self._inbound_audio_queue.task_done()
            except asyncio.TimeoutError:
                continue

    async def audio_out(self, audio_data: bytes, associated_text: Optional[str] = None) -> None:
        """Stream synthesized 24kHz / 16kHz audio chunk to the browser."""
        if not self._is_active:
            return
        try:
            # Send base64 audio chunk to browser
            b64_audio = base64.b64encode(audio_data).decode("ascii")
            msg = {
                "type": "audio",
                "data": b64_audio,
                "sample_rate": 24000,
            }
            if associated_text:
                msg["text"] = associated_text
            await self.websocket.send_text(json.dumps(msg))
        except Exception as e:
            logger.error(f"Error sending audio to browser: {e}")

    async def clear_audio(self) -> None:
        """Send instant barge-in purge signal to browser AudioContext."""
        if not self._is_active:
            return
        try:
            await self.websocket.send_text(json.dumps({"type": "clear"}))
        except Exception as e:
            logger.error(f"Error sending clear to browser: {e}")

    async def push_inbound_audio(self, pcm_bytes: bytes) -> None:
        """Enqueue PCM chunk from browser WebSocket message."""
        if self._is_active:
            await self._inbound_audio_queue.put(pcm_bytes)

    async def send_state_update(self, state: str) -> None:
        """Push pipeline state changes (LISTENING, THINKING, SPEAKING) to browser UI."""
        if self._is_active:
            try:
                await self.websocket.send_text(json.dumps({"type": "state", "state": state}))
            except Exception:
                pass

    async def send_sentence(self, text: str) -> None:
        """Stream synthesized sentence chunk to browser UI for immediate low-latency speech."""
        if self._is_active and text.strip():
            try:
                await self.websocket.send_text(json.dumps({
                    "type": "sentence_chunk",
                    "text": text.strip(),
                }))
            except Exception:
                pass

    async def send_transcript(self, role: str, text: str, latency: Optional[dict] = None) -> None:
        """Push conversation turn to browser transcript log."""
        if self._is_active:
            try:
                msg = {
                    "type": "transcript",
                    "role": role,
                    "text": text,
                    "latency": latency or {},
                }
                await self.websocket.send_text(json.dumps(msg))
            except Exception:
                pass

    async def send_status_info(self, info: dict) -> None:
        """Push backend configuration status (demo/live) to browser UI."""
        if self._is_active:
            try:
                await self.websocket.send_text(json.dumps({"type": "info", **info}))
            except Exception:
                pass

    async def send_error(self, message: str) -> None:
        """Push human-readable error to browser UI."""
        if self._is_active:
            try:
                await self.websocket.send_text(json.dumps({"type": "error", "message": message}))
            except Exception:
                pass
