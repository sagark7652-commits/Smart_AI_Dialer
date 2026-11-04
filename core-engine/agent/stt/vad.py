"""Voice Activity Detection (VAD), Prefix Padding, Echo Guard, and Smart End-of-Turn Detection."""

from collections import deque
import re
import time
from typing import Deque, Optional
import numpy as np
from agent.logger import setup_logger

logger = setup_logger("stt.vad")

# Conjunctions in English, Hindi, and Marathi indicating speaker intends to continue
CONTINUATION_CONJUNCTIONS = [
    # English
    "and", "but", "or", "because", "so", "then", "if", "that", "like", "also",
    # Hindi (Latin & Devanagari)
    "aur", "lekin", "kyunki", "ya", "toh", "ki", "par", "magar", "aur bhi",
    "और", "लेकिन", "क्योंकि", "या", "तो", "कि", "पर", "मगर",
    # Marathi (Latin & Devanagari)
    "ani", "pan", "kinva", "karan", "mhanun", "tar", "tari",
    "आणि", "पण", "किंवा", "कारण", "म्हणून", "तर", "तरी",
]

SENTENCE_ENDINGS = [".", "?", "!", "।"]


class VoiceActivityDetector:
    """Robust VAD with Prefix Padding, Sustained Barge-in Detection, and Smart End-of-Turn Detection."""

    def __init__(
        self,
        sample_rate: int = 16000,
        rms_threshold: float = 350.0,
        min_speech_ms: int = 120,
        end_of_turn_silence_ms: int = 600,
        extra_wait_ms: int = 350,
        barge_in_min_speech_ms: int = 250,
        prefix_padding_ms: int = 200,
        headset_mode: bool = True,
    ) -> None:
        self.sample_rate = sample_rate
        self.rms_threshold = rms_threshold
        self.min_speech_ms = min_speech_ms
        self.end_of_turn_silence_ms = end_of_turn_silence_ms
        self.extra_wait_ms = extra_wait_ms
        self.barge_in_min_speech_ms = barge_in_min_speech_ms
        self.prefix_padding_ms = prefix_padding_ms
        self.headset_mode = headset_mode

        # Ring buffer for prefix audio frames so initial syllable is never clipped
        # 25ms @ 16kHz int16 = 800 bytes per chunk
        self._prefix_buffer: Deque[bytes] = deque(maxlen=max(int(prefix_padding_ms / 25), 8))

        # Internal state
        self.is_speaking = False
        self.speech_start_time: Optional[float] = None
        self.last_speech_time: Optional[float] = None
        self.silence_start_time: Optional[float] = None

        # Sustained speech tracking for barge-in
        self.barge_in_speech_start: Optional[float] = None

    def calculate_rms(self, pcm16_bytes: bytes) -> float:
        """Calculate Root Mean Square (RMS) energy of 16-bit PCM audio chunk."""
        if not pcm16_bytes:
            return 0.0
        samples = np.frombuffer(pcm16_bytes, dtype=np.int16)
        if len(samples) == 0:
            return 0.0
        return float(np.sqrt(np.mean(samples.astype(np.float32) ** 2)))

    def is_mid_sentence(self, partial_text: str) -> bool:
        """Check if partial transcript ends with a conjunction or lacks sentence-ending punctuation."""
        clean = partial_text.strip()
        if not clean:
            return False

        # Ends with sentence terminator
        if clean[-1] in SENTENCE_ENDINGS:
            return False

        # Check trailing words for conjunctions
        words = clean.lower().split()
        if words and words[-1] in CONTINUATION_CONJUNCTIONS:
            return True

        # Mid-sentence without terminating punctuation
        return True

    def process_chunk(
        self,
        pcm16_bytes: bytes,
        is_agent_speaking: bool = False,
        partial_transcript: str = "",
    ) -> tuple[bool, bool, bool]:
        """Process an incoming audio frame.

        Args:
            pcm16_bytes: 16-bit PCM mono audio chunk.
            is_agent_speaking: Whether agent is currently playing voice output.
            partial_transcript: Most recent interim/partial STT text for smart wait calculation.

        Returns:
            (is_voice_active: bool, is_end_of_turn: bool, is_barge_in_confirmed: bool)
        """
        now = time.perf_counter()
        rms = self.calculate_rms(pcm16_bytes)

        # Echo protection: if not in headset mode and agent is speaking, raise threshold by 1.8x
        effective_threshold = self.rms_threshold
        if not self.headset_mode and is_agent_speaking:
            effective_threshold = self.rms_threshold * 1.85

        is_speech_chunk = rms >= effective_threshold

        # Maintain prefix audio padding buffer
        self._prefix_buffer.append(pcm16_bytes)

        is_end_of_turn = False
        is_barge_in_confirmed = False

        if is_speech_chunk:
            self.last_speech_time = now
            self.silence_start_time = None

            # Track barge-in sustained speech
            if is_agent_speaking:
                if self.barge_in_speech_start is None:
                    self.barge_in_speech_start = now
                elif (now - self.barge_in_speech_start) * 1000 >= self.barge_in_min_speech_ms:
                    is_barge_in_confirmed = True
            else:
                self.barge_in_speech_start = None

            if not self.is_speaking:
                if self.speech_start_time is None:
                    self.speech_start_time = now
                elif (now - self.speech_start_time) * 1000 >= self.min_speech_ms:
                    self.is_speaking = True
        else:
            self.speech_start_time = None
            self.barge_in_speech_start = None

            if self.is_speaking:
                if self.silence_start_time is None:
                    self.silence_start_time = now
                else:
                    silence_duration_ms = (now - self.silence_start_time) * 1000

                    # Smart end-of-turn: add extra wait ms if caller paused mid-sentence
                    required_silence_ms = self.end_of_turn_silence_ms
                    if self.is_mid_sentence(partial_transcript):
                        required_silence_ms += self.extra_wait_ms

                    if silence_duration_ms >= required_silence_ms:
                        is_end_of_turn = True
                        self.is_speaking = False
                        self.silence_start_time = None

        return (self.is_speaking or is_speech_chunk), is_end_of_turn, is_barge_in_confirmed

    def get_prefix_audio(self) -> bytes:
        """Return buffered prefix audio frames to prepend to initial speech onset."""
        return b"".join(self._prefix_buffer)

    def reset(self) -> None:
        """Reset internal speech state for a new conversational turn."""
        self.is_speaking = False
        self.speech_start_time = None
        self.last_speech_time = None
        self.silence_start_time = None
        self.barge_in_speech_start = None
