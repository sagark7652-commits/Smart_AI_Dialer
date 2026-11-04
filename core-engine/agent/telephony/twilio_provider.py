"""Twilio Telephony Provider using Twilio Media Streams over WebSocket.

Features:
- Paced 20ms audio frame streaming (8kHz G.711 Mu-Law).
- Instant barge-in queue purging with Twilio 'clear' event.
- Twilio 'mark' event tracking to verify played audio.
- Dual-channel WAV recording in debug mode (caller and agent).
- Call transfer, status callback tracking, and graceful hangup.
"""

import asyncio
import json
from pathlib import Path
import time
from typing import AsyncIterator, Dict, List, Optional, Set
import wave
import httpx
from agent.config import get_settings
from agent.logger import setup_logger
from agent.telephony.audio_helpers import AudioCodec
from agent.telephony.base import BaseTelephonyProvider

logger = setup_logger("telephony.twilio")


class TwilioProvider(BaseTelephonyProvider):
    """Twilio Media Streams implementation behind BaseTelephonyProvider."""

    FRAME_SIZE_BYTES = 160  # 20ms @ 8kHz G.711 Mu-Law (1 sample = 1 byte)

    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        phone_number: Optional[str] = None,
        recordings_dir: str = "recordings",
        debug: bool = False,
    ) -> None:
        settings = get_settings()
        self.account_sid = account_sid or settings.twilio_account_sid
        self.auth_token = auth_token or settings.twilio_auth_token
        self.phone_number = phone_number or settings.twilio_phone_number

        self.stream_sid: Optional[str] = None
        self.call_sid: Optional[str] = None
        self.websocket = None
        self.debug = debug

        self._inbound_audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._is_active = False

        # Mark tracking for played audio verification
        self._sent_marks: Dict[str, str] = {}  # mark_name -> sentence_text
        self._confirmed_marks: Set[str] = set()
        self._mark_counter = 0

        # Pacing and cancellation control
        self._current_pacing_task: Optional[asyncio.Task] = None
        self._clear_event = asyncio.Event()

        # Dual-track audio recordings
        self.recordings_dir = Path(recordings_dir)
        self.recordings_dir.mkdir(parents=True, exist_ok=True)
        self._caller_wav_fp: Optional[wave.Wave_write] = None
        self._agent_wav_fp: Optional[wave.Wave_write] = None

        # DTMF callback
        self.dtmf_callback = None

    def start_recording(self, call_id: str) -> None:
        """Initialize separate WAV recordings for caller and agent audio at 8kHz 16-bit PCM."""
        caller_wav_path = self.recordings_dir / f"{call_id}_caller.wav"
        agent_wav_path = self.recordings_dir / f"{call_id}_agent.wav"
        try:
            self._caller_wav_fp = wave.open(str(caller_wav_path), "wb")
            self._caller_wav_fp.setnchannels(1)
            self._caller_wav_fp.setsampwidth(2)
            self._caller_wav_fp.setframerate(8000)

            self._agent_wav_fp = wave.open(str(agent_wav_path), "wb")
            self._agent_wav_fp.setnchannels(1)
            self._agent_wav_fp.setsampwidth(2)
            self._agent_wav_fp.setframerate(8000)
            logger.info(f"Initialized call debug recordings: {caller_wav_path.name}, {agent_wav_path.name}")
        except Exception as e:
            logger.error(f"Failed to initialize WAV recordings: {e}")

    def stop_recording(self) -> None:
        """Close and flush active WAV recording files."""
        if self._caller_wav_fp:
            try:
                self._caller_wav_fp.close()
            except Exception:
                pass
            self._caller_wav_fp = None
        if self._agent_wav_fp:
            try:
                self._agent_wav_fp.close()
            except Exception:
                pass
            self._agent_wav_fp = None

    async def make_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        webhook_url: Optional[str] = None,
        status_callback_url: Optional[str] = None,
    ) -> str:
        """Place an outbound PSTN call via Twilio REST API with status callbacks."""
        if not self.account_sid or not self.auth_token:
            raise ValueError("Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) not set.")

        caller_id = from_number or self.phone_number
        if not caller_id:
            raise ValueError("No Twilio caller ID provided or configured in .env.")

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls.json"
        auth = (self.account_sid, self.auth_token)
        payload = {
            "To": to_number,
            "From": caller_id,
            "Url": webhook_url,
            "MachineDetection": "Enable",
            "AsyncAmd": "true",
        }
        if status_callback_url:
            payload["StatusCallback"] = status_callback_url
            payload["StatusCallbackEvent"] = ["initiated", "ringing", "answered", "completed"]
            payload["AsyncAmdStatusCallback"] = status_callback_url

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(api_url, auth=auth, data=payload)
            if resp.status_code not in (200, 201):
                logger.error(f"Twilio call creation failed: {resp.status_code} - {resp.text}")
                resp.raise_for_status()

            data = resp.json()
            call_sid = data.get("sid", "")
            self.call_sid = call_sid
            logger.info(f"Twilio outbound call placed successfully: CallSid={call_sid} to {to_number}")
            return call_sid

    async def hangup(self, call_id: str) -> None:
        """Terminate active Twilio call via REST API."""
        if not self.account_sid or not self.auth_token:
            return

        target_sid = call_id or self.call_sid
        if not target_sid:
            return

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls/{target_sid}.json"
        auth = (self.account_sid, self.auth_token)
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(api_url, auth=auth, data={"Status": "completed"})
            if resp.status_code in (200, 204):
                logger.info(f"Twilio call successfully hung up: {target_sid}")
            else:
                logger.warning(f"Twilio hangup failed: {resp.status_code} - {resp.text}")

    def attach_websocket(self, websocket, stream_sid: str) -> None:
        """Attach active FastAPI WebSocket session to this provider instance."""
        self.websocket = websocket
        self.stream_sid = stream_sid
        self._is_active = True
        self._clear_event.clear()

    async def handle_inbound_message(self, message_str: str) -> None:
        """Process incoming JSON message received from Twilio Media Streams."""
        try:
            data = json.loads(message_str)
            event = data.get("event")

            if event == "connected":
                logger.info("Twilio Media Stream 'connected' handshake received.")

            elif event == "start":
                self.stream_sid = data.get("streamSid") or data.get("start", {}).get("streamSid")
                self.call_sid = data.get("start", {}).get("callSid")
                logger.info(
                    f"Twilio Media Stream started: streamSid={self.stream_sid}, callSid={self.call_sid}"
                )
                if self.call_sid:
                    self.start_recording(self.call_sid)

            elif event == "media":
                payload_b64 = data.get("media", {}).get("payload", "")
                if payload_b64:
                    mulaw_chunk = AudioCodec.from_base64(payload_b64)
                    # Convert 8kHz Mu-Law -> 8kHz PCM16 for VAD & recording
                    pcm8k = AudioCodec.ulaw2linear(mulaw_chunk)
                    if self._caller_wav_fp:
                        try:
                            self._caller_wav_fp.writeframes(pcm8k)
                        except Exception:
                            pass

                    # Resample to 16kHz PCM16 for STT pipeline
                    pcm16k = AudioCodec.resample_pcm(pcm8k, in_rate=8000, out_rate=16000)
                    await self._inbound_audio_queue.put(pcm16k)

            elif event == "mark":
                mark_name = data.get("mark", {}).get("name", "")
                if mark_name:
                    self._confirmed_marks.add(mark_name)
                    logger.debug(f"Twilio confirmed playback of mark: '{mark_name}'")

            elif event == "clear":
                logger.debug("Twilio stream clear confirmed.")

            elif event == "dtmf":
                dtmf_payload = data.get("dtmf", {})
                digit = dtmf_payload.get("digit") or data.get("digit")
                logger.info(f"Twilio DTMF received: digit='{digit}' on stream {self.stream_sid}")
                if digit and self.dtmf_callback:
                    res = self.dtmf_callback(str(digit))
                    if asyncio.iscoroutine(res):
                        await res

            elif event == "stop":
                logger.info("Twilio Media Stream received 'stop' event.")
                self._is_active = False
                self.stop_recording()

        except Exception as e:
            logger.error(f"Error handling Twilio inbound message: {e}")

    async def audio_in(self) -> AsyncIterator[bytes]:
        """Stream converted 16kHz PCM audio received from caller."""
        while self._is_active or not self._inbound_audio_queue.empty():
            try:
                chunk = await asyncio.wait_for(self._inbound_audio_queue.get(), timeout=0.2)
                yield chunk
                self._inbound_audio_queue.task_done()
            except asyncio.TimeoutError:
                continue

    async def audio_out(self, audio_data: bytes, associated_text: Optional[str] = None) -> None:
        """Paced audio transmission sending 20ms G.711 Mu-Law frames over Twilio WebSocket."""
        if not self.websocket or not self.stream_sid or not self._is_active:
            return

        try:
            # Resample TTS audio (assumed 24kHz or 16kHz) to 8kHz PCM, then convert to Mu-Law
            pcm8k = AudioCodec.resample_pcm(audio_data, in_rate=24000, out_rate=8000)
            if self._agent_wav_fp:
                try:
                    self._agent_wav_fp.writeframes(pcm8k)
                except Exception:
                    pass

            mulaw_bytes = AudioCodec.linear2ulaw(pcm8k)
            total_len = len(mulaw_bytes)

            # Assign mark to this sentence chunk
            self._mark_counter += 1
            mark_name = f"m_{self._mark_counter}_{int(time.time()*1000)}"
            if associated_text:
                self._sent_marks[mark_name] = associated_text

            # Send in paced 20ms frames (160 bytes each)
            offset = 0
            while offset < total_len:
                if self._clear_event.is_set() or not self._is_active:
                    break

                frame = mulaw_bytes[offset : offset + self.FRAME_SIZE_BYTES]
                if frame:
                    b64_payload = AudioCodec.to_base64(frame)
                    msg = {
                        "event": "media",
                        "streamSid": self.stream_sid,
                        "media": {"payload": b64_payload},
                    }
                    await self.websocket.send_text(json.dumps(msg))

                offset += self.FRAME_SIZE_BYTES
                # Pacing: 20ms per frame to prevent buffer overflow or underrun
                await asyncio.sleep(0.018)

            # Emit mark event at completion of phrase
            if not self._clear_event.is_set() and self._is_active:
                mark_msg = {
                    "event": "mark",
                    "streamSid": self.stream_sid,
                    "mark": {"name": mark_name},
                }
                await self.websocket.send_text(json.dumps(mark_msg))

        except Exception as e:
            logger.error(f"Error sending paced audio to Twilio: {e}")

    async def clear_audio(self) -> None:
        """Instantly flush Twilio audio buffer and cancel pending frames (barge-in)."""
        if not self.websocket or not self.stream_sid:
            return

        try:
            self._clear_event.set()
            logger.info(f"⚡ Twilio barge-in: Sending 'clear' event for stream {self.stream_sid}")
            msg = {
                "event": "clear",
                "streamSid": self.stream_sid,
            }
            await self.websocket.send_text(json.dumps(msg))
            # Reset event after short pause so subsequent phrases can play
            await asyncio.sleep(0.05)
            self._clear_event.clear()
        except Exception as e:
            logger.error(f"Error sending clear to Twilio: {e}")

    def get_played_text_summary(self) -> str:
        """Return text of sentences confirmed played to caller via Twilio mark events."""
        confirmed_texts = [
            text for mark, text in self._sent_marks.items() if mark in self._confirmed_marks
        ]
        return " ".join(confirmed_texts)

    async def transfer_call(self, call_id: str, destination: str) -> bool:
        """Transfer active Twilio call to human operator or clinic reception via TwiML Dial."""
        if not self.account_sid or not self.auth_token:
            logger.warning("Twilio credentials missing; transfer simulated.")
            return True

        target_sid = call_id or self.call_sid
        if not target_sid:
            logger.error("No active CallSid available to transfer.")
            return False

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls/{target_sid}.json"
        auth = (self.account_sid, self.auth_token)
        twiml = f"<Response><Dial>{destination}</Dial></Response>"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(api_url, auth=auth, data={"Twiml": twiml})
                if res.status_code in (200, 202):
                    logger.info(f"Twilio call {target_sid} transferred successfully to {destination}")
                    return True
                logger.error(f"Twilio transfer failed: {res.status_code} - {res.text}")
                return False
        except Exception as e:
            logger.error(f"Error transferring Twilio call: {e}")
            return False

    @staticmethod
    def generate_twiml(stream_url: str) -> str:
        """Generate TwiML instructing Twilio to open bi-directional WebSocket Media Stream."""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{stream_url}" />
    </Connect>
</Response>"""
