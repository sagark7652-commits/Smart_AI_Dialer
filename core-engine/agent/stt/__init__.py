"""Speech-to-Text (STT) package."""

from agent.stt.base import BaseSTT, TranscriptionEvent
from agent.stt.deepgram_stt import DeepgramSTT
from agent.stt.audio_capture import MicrophoneCapture
from agent.stt.phone_simulator import PhoneAudioSimulator
from agent.stt.factory import get_stt_provider

__all__ = [
    "BaseSTT",
    "TranscriptionEvent",
    "DeepgramSTT",
    "MicrophoneCapture",
    "PhoneAudioSimulator",
    "get_stt_provider",
]
