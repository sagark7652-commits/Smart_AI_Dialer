"""High-clarity, continuous-stream audio player for local speaker playback with zero clicks and instant barge-in."""

import io
import queue
import threading
import time
import wave
from typing import Callable, Optional
import numpy as np
from scipy import signal
import sounddevice as sd
from agent.logger import setup_logger
from agent.telephony.audio_helpers import AudioCodec

logger = setup_logger("tts.player")


class AudioPlayer:
    """Continuous low-latency audio player with sample rate matching, crossfading, and instant flush."""

    def __init__(self, default_sample_rate: int = 24000) -> None:
        self.default_sample_rate = default_sample_rate
        self.playback_queue: queue.Queue[Optional[bytes]] = queue.Queue()
        self._stop_event = threading.Event()
        self._interrupt_event = threading.Event()
        self._is_playing = False
        self.on_first_audio: Optional[Callable[[], None]] = None
        self._first_audio_signaled = False

        # Query native device parameters
        self.device_info = self._get_default_output_device_info()
        self.target_sample_rate = int(self.device_info.get("default_samplerate", 44100))
        self.device_name = self.device_info.get("name", "Default Audio Device")
        self.device_id = self.device_info.get("index", None)

        # Startup self-check
        self._log_startup_self_check()

        # Dedicated playback thread
        self._worker_thread = threading.Thread(target=self._playback_loop, daemon=True)
        self._worker_thread.start()

    def _get_default_output_device_info(self) -> dict:
        """Query host operating system for default audio playback device."""
        try:
            default_out = sd.default.device[1]
            if default_out is not None and default_out >= 0:
                dev = sd.query_devices(default_out)
                return {"index": default_out, **dev}
            # Fallback search for first device with output channels
            for idx, dev in enumerate(sd.query_devices()):
                if dev.get("max_output_channels", 0) > 0:
                    return {"index": idx, **dev}
        except Exception as e:
            logger.warning(f"Failed to query audio output device: {e}")
        return {"name": "Default Speaker", "default_samplerate": 44100.0, "max_output_channels": 2}

    def _log_startup_self_check(self) -> None:
        """Self-check and diagnostic output for TTS/audio alignment."""
        logger.info(
            f"[AUDIO SUBSYSTEM] Device: '{self.device_name}' (ID: {self.device_id}) | "
            f"Native SR: {self.target_sample_rate}Hz | TTS Source SR: {self.default_sample_rate}Hz"
        )
        if self.target_sample_rate != self.default_sample_rate:
            logger.info(
                f"[AUDIO SUBSYSTEM] Active rational polyphase resampler engaged: "
                f"{self.default_sample_rate}Hz -> {self.target_sample_rate}Hz."
            )

    def enqueue(self, audio_data: bytes) -> None:
        """Enqueue audio chunk (WAV or raw 16-bit PCM) for continuous playback."""
        if audio_data and not self._interrupt_event.is_set():
            self.playback_queue.put(audio_data)

    def clear(self) -> None:
        """Instantaneously drop all queued audio and halt speaker playback (barge-in)."""
        logger.debug("Barge-in: Clearing playback audio queue.")
        self._interrupt_event.set()
        while not self.playback_queue.empty():
            try:
                self.playback_queue.get_nowait()
                self.playback_queue.task_done()
            except queue.Empty:
                break
        self._first_audio_signaled = False
        try:
            sd.stop()
        except Exception:
            pass
        self._interrupt_event.clear()

    def reset_first_audio_flag(self) -> None:
        """Reset signal flag for latency timing on a new conversational turn."""
        self._first_audio_signaled = False

    def is_playing(self) -> bool:
        """Return whether audio is currently playing or queued."""
        return self._is_playing or not self.playback_queue.empty()

    def wait_until_done(self, timeout: float = 10.0) -> None:
        """Wait until all queued audio finishes playing."""
        start = time.time()
        while (self.is_playing() or not self.playback_queue.empty()) and (time.time() - start < timeout):
            time.sleep(0.04)

    def _decode_and_prep(self, data: bytes) -> tuple[np.ndarray, int]:
        """Decode, crossfade boundaries, resample, and normalize audio chunk."""
        # 1. Decode WAV vs raw PCM
        if len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
            with wave.open(io.BytesIO(data), "rb") as wf:
                in_sr = wf.getframerate()
                frames = wf.readframes(wf.getnframes())
                audio_array = np.frombuffer(frames, dtype=np.int16)
                if wf.getnchannels() > 1:
                    audio_array = audio_array.reshape(-1, wf.getnchannels())[:, 0]
        else:
            in_sr = self.default_sample_rate
            audio_array = np.frombuffer(data, dtype=np.int16).copy()

        if len(audio_array) == 0:
            return np.array([], dtype=np.int16), in_sr

        # 2. Smooth chunk boundary clicks using micro cosine taper (2.5ms = 60 samples at 24kHz)
        ramp_len = min(len(audio_array) // 4, int(in_sr * 0.0025))
        if ramp_len > 2:
            ramp = (1.0 - np.cos(np.linspace(0, np.pi, ramp_len))) / 2.0
            audio_array[:ramp_len] = (audio_array[:ramp_len] * ramp).astype(np.int16)
            audio_array[-ramp_len:] = (audio_array[-ramp_len:] * ramp[::-1]).astype(np.int16)

        # 3. Polyphase resample to device native sample rate if needed
        if in_sr != self.target_sample_rate:
            gcd = np.gcd(in_sr, self.target_sample_rate)
            up = int(self.target_sample_rate // gcd)
            down = int(in_sr // gcd)
            audio_array = signal.resample_poly(audio_array, up, down).astype(np.int16)

        # 4. Volume headroom normalization (-1.0 dBFS ceiling)
        max_val = np.max(np.abs(audio_array))
        if max_val > 30000:
            audio_array = (audio_array * (30000.0 / max_val)).astype(np.int16)

        return audio_array, self.target_sample_rate

    def _playback_loop(self) -> None:
        """Continuous output stream playback avoiding start/stop clicks."""
        stream = None
        current_sr = self.target_sample_rate

        try:
            stream = sd.OutputStream(
                samplerate=current_sr,
                channels=1,
                dtype="int16",
                device=self.device_id,
            )
            stream.start()
        except Exception as e:
            logger.warning(f"Could not open persistent OutputStream ({e}). Falling back to managed play().")
            stream = None

        while not self._stop_event.is_set():
            try:
                chunk = self.playback_queue.get(timeout=0.1)
            except queue.Empty:
                self._is_playing = False
                continue

            if chunk is None:
                break

            if self._interrupt_event.is_set():
                self.playback_queue.task_done()
                continue

            self._is_playing = True
            try:
                audio_array, sr = self._decode_and_prep(chunk)
                if len(audio_array) == 0:
                    self.playback_queue.task_done()
                    continue

                if not self._first_audio_signaled and self.on_first_audio:
                    self._first_audio_signaled = True
                    self.on_first_audio()

                if stream and stream.active and sr == current_sr and not self._interrupt_event.is_set():
                    stream.write(audio_array)
                elif self.device_id is not None and not self._interrupt_event.is_set():
                    try:
                        sd.play(audio_array, samplerate=sr, blocking=True, device=self.device_id)
                    except Exception as play_err:
                        logger.debug(f"Hardware playback failed on device {self.device_id}: {play_err}")

            except Exception as e:
                logger.error(f"Playback output error: {e}")
            finally:
                self.playback_queue.task_done()
                if self.playback_queue.empty():
                    self._is_playing = False

        if stream:
            try:
                stream.stop()
                stream.close()
            except Exception:
                pass

    def close(self) -> None:
        """Stop worker and release audio stream."""
        self._stop_event.set()
        self.playback_queue.put(None)
        try:
            sd.stop()
        except Exception:
            pass
        if hasattr(self, "_worker_thread") and self._worker_thread.is_alive():
            try:
                self._worker_thread.join(timeout=1.0)
            except Exception:
                pass
