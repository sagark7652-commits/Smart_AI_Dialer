"""Exotel Telephony Provider using Exotel Voicebot / Stream Applet over WebSocket.

Reference documentation:
- Exotel AgentStream / Voicebot Applet Bidirectional Audio Streaming Specification
- Exotel Outbound Connect Calls API: https://developer.exotel.com/api/
"""

import asyncio
import json
from typing import AsyncIterator, Optional
import httpx
from agent.config import get_settings
from agent.logger import setup_logger
from agent.telephony.audio_helpers import AudioCodec
from agent.telephony.base import BaseTelephonyProvider

logger = setup_logger("telephony.exotel")


class ExotelProvider(BaseTelephonyProvider):
    """Exotel Voicebot WebSocket stream adapter conforming to BaseTelephonyProvider."""

    def __init__(
        self,
        account_sid: Optional[str] = None,
        api_key: Optional[str] = None,
        api_token: Optional[str] = None,
        subdomain: Optional[str] = None,
        caller_id: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self.account_sid = account_sid or settings.exotel_account_sid
        self.api_key = api_key or settings.exotel_api_key
        self.api_token = api_token or settings.exotel_api_token
        self.subdomain = subdomain or settings.exotel_subdomain or "api.exotel.com"
        self.caller_id = caller_id or settings.exotel_caller_id

        self.stream_sid: Optional[str] = None
        self.call_sid: Optional[str] = None
        self.websocket = None

        self._inbound_audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._is_active = False

    async def make_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ) -> str:
        """Place an outbound call via Exotel's Calls/connect.json REST API."""
        if not self.account_sid or not self.api_key or not self.api_token:
            raise ValueError(
                "Exotel credentials (EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN) not set."
            )

        caller = from_number or self.caller_id
        if not caller:
            raise ValueError("No Exotel virtual number (CallerId / ExoPhone) configured in .env.")

        api_url = f"https://{self.subdomain}/v1/Accounts/{self.account_sid}/Calls/connect.json"
        auth = (self.api_key, self.api_token)

        # In Exotel: 'From' is the user to dial first, 'To' is the ExoPhone, or vice-versa with 'Url' applet
        payload = {
            "From": to_number,
            "To": caller,
            "CallerId": caller,
            "Url": webhook_url,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(api_url, auth=auth, data=payload)
            if resp.status_code not in (200, 201):
                logger.error(f"Exotel call failed: {resp.status_code} - {resp.text}")
                resp.raise_for_status()

            data = resp.json()
            call_obj = data.get("Call", {})
            call_sid = call_obj.get("Sid", "")
            self.call_sid = call_sid
            logger.info(f"Exotel call initiated: CallSid={call_sid}")
            return call_sid

    async def hangup(self, call_id: str) -> None:
        """Hang up active Exotel call via REST API."""
        if not self.account_sid or not self.api_key or not self.api_token:
            return

        api_url = (
            f"https://{self.subdomain}/v1/Accounts/{self.account_sid}/Calls/{call_id}.json"
        )
        auth = (self.api_key, self.api_token)
        async with httpx.AsyncClient() as client:
            resp = await client.post(api_url, auth=auth, data={"Status": "completed"})
            if resp.status_code in (200, 204):
                logger.info(f"Exotel call hung up: {call_id}")
            else:
                logger.warning(f"Exotel hangup failed: {resp.status_code} - {resp.text}")

    def attach_websocket(self, websocket, stream_sid: str) -> None:
        """Attach active WebSocket session from Exotel Voicebot applet."""
        self.websocket = websocket
        self.stream_sid = stream_sid
        self._is_active = True

    async def handle_inbound_message(self, message_str: str) -> None:
        """Handle incoming JSON message from Exotel Voicebot WebSocket."""
        try:
            data = json.loads(message_str)
            event = data.get("event")

            if event == "connected":
                logger.info("Exotel WebSocket connected.")

            elif event == "start":
                self.stream_sid = data.get("stream_sid")
                self.call_sid = data.get("call_sid") or data.get("start", {}).get("call_sid")
                logger.info(
                    f"Exotel Stream started: stream_sid={self.stream_sid}, call_sid={self.call_sid}"
                )

            elif event == "media":
                media = data.get("media", {})
                payload_b64 = media.get("payload", "")
                if payload_b64:
                    raw_audio = AudioCodec.from_base64(payload_b64)
                    # Exotel standard stream is 8kHz linear PCM or mu-law
                    # Check whether payload matches mu-law or PCM; convert to 16kHz PCM for STT
                    if len(raw_audio) > 0:
                        # Exotel defaults to 8kHz 16-bit linear PCM
                        pcm16k = AudioCodec.resample_pcm(raw_audio, in_rate=8000, out_rate=16000)
                        await self._inbound_audio_queue.put(pcm16k)

            elif event == "stop":
                logger.info("Exotel Stream received 'stop' event.")
                self._is_active = False

        except Exception as e:
            logger.error(f"Error handling Exotel inbound message: {e}")

    async def audio_in(self) -> AsyncIterator[bytes]:
        """Stream converted 16kHz PCM audio from caller."""
        while self._is_active or not self._inbound_audio_queue.empty():
            try:
                chunk = await asyncio.wait_for(self._inbound_audio_queue.get(), timeout=0.2)
                yield chunk
                self._inbound_audio_queue.task_done()
            except asyncio.TimeoutError:
                continue

    async def audio_out(self, audio_data: bytes) -> None:
        """Send synthesized audio back to caller complying with Exotel 320-byte framing."""
        if not self.websocket or not self.stream_sid or not self._is_active:
            return

        try:
            # Resample TTS audio (24kHz/16kHz) to 8kHz 16-bit linear PCM
            pcm8k = AudioCodec.resample_pcm(audio_data, in_rate=24000, out_rate=8000)

            # Exotel Rule: chunk sizes must strictly be a multiple of 320 bytes
            aligned_pcm = AudioCodec.align_to_boundary(pcm8k, alignment=320)
            b64_payload = AudioCodec.to_base64(aligned_pcm)

            msg = {
                "event": "media",
                "stream_sid": self.stream_sid,
                "media": {
                    "payload": b64_payload,
                },
            }
            await self.websocket.send_text(json.dumps(msg))
        except Exception as e:
            logger.error(f"Error sending audio to Exotel: {e}")

    async def clear_audio(self) -> None:
        """Instruct Exotel to flush buffered audio queues immediately on barge-in."""
        if not self.websocket or not self.stream_sid:
            return

        try:
            logger.debug(f"Sending Exotel 'clear' event for stream_sid={self.stream_sid}")
            msg = {
                "event": "clear",
                "stream_sid": self.stream_sid,
            }
            await self.websocket.send_text(json.dumps(msg))
        except Exception as e:
            logger.error(f"Error sending clear to Exotel: {e}")

    async def transfer_call(self, call_id: str, destination: str) -> bool:
        """Handle call transfer on Exotel.

        NOTE ON EXOTEL ARCHITECTURE:
        Unlike Twilio's live REST Call update API, Exotel does NOT support mid-stream POST
        requests to /Calls/{CallSid}.json to modify a live call.
        In Exotel, live call transfer is achieved through Exotel Flow Builder:
        1. Voicebot applet emits a handover/stop event or returns a transfer outcome.
        2. Flow connects directly to a downstream 'Connect Applet' or 'Passthru Applet'
           which routes the caller to the destination agent/phone number.
        """
        logger.info(
            f"Exotel transfer requested for CallSid: {call_id or self.call_sid} to destination: {destination}. "
            "Signaling flow completion to advance to downstream Exotel Connect/Passthru Applet."
        )
        self._is_active = False
        return True
