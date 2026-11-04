"""Deepgram streaming WebSocket STT implementation."""

import asyncio
import json
import time
from typing import AsyncIterator, Optional
import urllib.parse
import websockets
from agent.config import get_settings
from agent.logger import setup_logger
from agent.stt.base import BaseSTT, TranscriptionEvent

logger = setup_logger("stt.deepgram")


class DeepgramSTT(BaseSTT):
    """Streaming Speech-To-Text client using Deepgram WebSocket API."""

    WS_BASE_URL = "wss://api.deepgram.com/v1/listen"
    DEFAULT_MODEL = "nova-3"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        sample_rate: int = 16000,
        encoding: str = "linear16",
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.deepgram_api_key
        self.model = model or getattr(settings, "deepgram_model", self.DEFAULT_MODEL)
        self.sample_rate = sample_rate
        self.encoding = encoding

        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._event_queue: asyncio.Queue[TranscriptionEvent] = asyncio.Queue()
        self._receive_task: Optional[asyncio.Task] = None
        self._is_active = False

        # Latency tracking
        self._last_speech_time: float = time.perf_counter()

        if not self.api_key:
            logger.warning(
                "DEEPGRAM_API_KEY is not set. DeepgramSTT will fail if started without a key."
            )

    def _build_ws_url(self, language: Optional[str]) -> str:
        # Default to multi for seamless English / Hindi / Hinglish / Marathi code-switching
        lang = language or "multi"
        if lang in ["auto", "hinglish"]:
            lang = "multi"

        params = {
            "model": self.model,
            "language": lang,
            "smart_format": "true",
            "interim_results": "true",
            "encoding": self.encoding,
            "sample_rate": str(self.sample_rate),
            "channels": "1",
            "endpointing": "300",
            "vad_events": "true",
        }
        return f"{self.WS_BASE_URL}?{urllib.parse.urlencode(params)}"

    async def start(self, language: Optional[str] = "multi") -> None:
        """Open WebSocket connection to Deepgram."""
        if not self.api_key:
            raise ValueError(
                "DEEPGRAM_API_KEY is missing. Please set it in your .env file or environment."
            )

        url = self._build_ws_url(language)
        headers = {"Authorization": f"Token {self.api_key}"}

        try:
            logger.info(f"Connecting to Deepgram streaming STT ({self.model}, lang={language})...")
            self.ws = await websockets.connect(
                url,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=10,
            )
            self._is_active = True
            self._receive_task = asyncio.create_task(self._receive_loop())
            logger.info("Deepgram streaming STT connection established.")
        except Exception as e:
            self._is_active = False
            logger.error(f"Failed to connect to Deepgram STT: {e}")
            raise ConnectionError(f"Could not connect to Deepgram STT: {e}")

    async def send_audio(self, audio_chunk: bytes) -> None:
        """Send raw PCM audio chunk to Deepgram WebSocket."""
        if not self.ws or not self._is_active:
            return

        try:
            self._last_speech_time = time.perf_counter()
            await self.ws.send(audio_chunk)
        except Exception as e:
            logger.error(f"Error sending audio chunk to Deepgram: {e}")
            self._is_active = False

    async def _receive_loop(self) -> None:
        """Listen for incoming JSON recognition events from Deepgram."""
        if not self.ws:
            return

        try:
            async for raw_message in self.ws:
                if not self._is_active:
                    break

                try:
                    data = json.loads(raw_message)
                except Exception:
                    continue

                msg_type = data.get("type")
                if msg_type == "Results":
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if not alternatives:
                        continue

                    transcript = alternatives[0].get("transcript", "").strip()
                    if not transcript:
                        continue

                    confidence = alternatives[0].get("confidence", 1.0)
                    is_final = data.get("is_final", False)
                    speech_final = data.get("speech_final", False)
                    detected_lang = alternatives[0].get("languages", [None])[0]

                    # Measure latency from speech pause to final transcript arrival
                    latency_ms = None
                    if is_final or speech_final:
                        latency_ms = (time.perf_counter() - self._last_speech_time) * 1000

                    event = TranscriptionEvent(
                        text=transcript,
                        is_final=bool(is_final or speech_final),
                        confidence=confidence,
                        language=detected_lang,
                        latency_ms=latency_ms,
                    )
                    await self._event_queue.put(event)

                elif msg_type == "Metadata":
                    logger.debug(f"Deepgram Metadata received: {data.get('transaction_key')}")

        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"Deepgram WebSocket closed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in Deepgram receive loop: {e}")
        finally:
            self._is_active = False

    async def stream_events(self) -> AsyncIterator[TranscriptionEvent]:
        """Yield transcribed speech events (interim and final)."""
        while self._is_active or not self._event_queue.empty():
            try:
                event = await asyncio.wait_for(self._event_queue.get(), timeout=0.2)
                yield event
                self._event_queue.task_done()
            except asyncio.TimeoutError:
                continue

    async def stop(self) -> None:
        """Close WebSocket connection gracefully."""
        self._is_active = False
        if self.ws:
            try:
                # Send Deepgram stream termination message
                await self.ws.send(json.dumps({"type": "CloseStream"}))
                await asyncio.sleep(0.1)
                await self.ws.close()
            except Exception as e:
                logger.debug(f"Exception during STT stop: {e}")
            self.ws = None

        if self._receive_task:
            self._receive_task.cancel()
            self._receive_task = None
        logger.info("Deepgram STT stopped.")
