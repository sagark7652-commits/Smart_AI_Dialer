"""Microphone audio capture streaming 16kHz PCM chunks with optional phone audio simulation."""

import asyncio
try:
    import sounddevice as sd
except Exception:
    sd = None  # type: ignore

from agent.logger import setup_logger
from agent.stt.phone_simulator import PhoneAudioSimulator

logger = setup_logger("stt.capture")


class MicrophoneCapture:
    """Captures real-time audio from the default input device in small 20-30ms frames."""

    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_ms: int = 25,
        simulate_phone: bool = False,
    ) -> None:
        self.sample_rate = sample_rate
        self.chunk_ms = chunk_ms
        self.simulate_phone = simulate_phone
        self.block_size = int(self.sample_rate * (self.chunk_ms / 1000.0))

        self.audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._stream: Optional[sd.InputStream] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._is_running = False

    def _audio_callback(self, indata, frames, time_info, status) -> None:
        """PortAudio audio callback called on dedicated audio thread."""
        if status:
            logger.warning(f"Audio input status: {status}")

        if not self._is_running:
            return

        raw_bytes = indata.tobytes()

        # Apply phone audio simulation if enabled
        if self.simulate_phone:
            raw_bytes = PhoneAudioSimulator.simulate_telephony(raw_bytes)

        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self.audio_queue.put_nowait, raw_bytes)

    def start(self, loop: Optional[asyncio.AbstractEventLoop] = None) -> None:
        """Start microphone capture stream."""
        self._loop = loop or asyncio.get_running_loop()

        # Validate microphone availability
        try:
            device_info = sd.query_devices(kind="input")
            logger.info(f"Using audio input device: {device_info.get('name')}")
        except Exception as e:
            raise RuntimeError(
                f"No working microphone found. Please check audio input devices. Details: {e}"
            )

        self._is_running = True
        try:
            self._stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype="int16",
                blocksize=self.block_size,
                callback=self._audio_callback,
            )
            self._stream.start()
            logger.info(
                f"Microphone capture started ({self.sample_rate}Hz, {self.chunk_ms}ms chunks, phone_sim={self.simulate_phone})"
            )
        except Exception as e:
            self._is_running = False
            raise RuntimeError(f"Failed to open microphone audio stream: {e}")

    def stop(self) -> None:
        """Stop microphone capture stream."""
        self._is_running = False
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception as e:
                logger.warning(f"Error stopping audio input stream: {e}")
            self._stream = None
        logger.info("Microphone capture stopped.")

    async def stream_chunks(self) -> AsyncIterator[bytes]:
        """Yield captured PCM chunks asynchronously."""
        while self._is_running:
            try:
                chunk = await asyncio.wait_for(self.audio_queue.get(), timeout=0.5)
                yield chunk
                self.audio_queue.task_done()
            except asyncio.TimeoutError:
                continue
