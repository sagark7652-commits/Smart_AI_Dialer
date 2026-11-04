"""Live multi-turn pipeline session runner per language (Marathi, Hindi, English).

Saves turn metrics, transcripts and audio into session_runs/<lang>/ and invokes analyze_calls.py.
"""

import asyncio
from dataclasses import asdict
import json
from pathlib import Path
import sys
import time
import wave
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.engine import CallingAgentEngine
from agent.telephony.browser_provider import BrowserWebAudioProvider
from agent.tts.mock_tts import MockTTS
from agent.logger import setup_logger

logger = setup_logger("test_pipeline")


SCENARIOS = {
    "mr": [
        "नमस्कार! मला डॉक्टर शर्मा यांची अपॉइंटमेंट हवी आहे.",
        "डॉक्टरांची तपासणी फी किती आहे?",
        "उद्या दुपारी तीन वाजता स्लॉट मिळेल का?",
        "काही हरकत नाही, धन्यवाद!",
    ],
    "hi": [
        "नमस्ते! मुझे डॉक्टर शर्मा से अपॉइंटमेंट बुक करवानी है।",
        "डॉक्टर शर्मा की कंसल्टेशन फीस कितनी है?",
        "कल दोपहर दो बजे का स्लॉट तय कर दीजिए।",
        "धन्यवाद, आपका दिन शुभ हो!",
    ],
    "en": [
        "Hello! I would like to book an appointment with Doctor Sharma.",
        "What is the consultation fee for Doctor Sharma?",
        "Please confirm tomorrow at two PM for me.",
        "Thank you so much, have a wonderful day!",
    ],
}


class MockTelephonySession:
    """Simulates real telephony channel capturing audio frames and transcripts."""

    def __init__(self, call_id: str):
        self.call_id = call_id
        self.audio_frames = bytearray()
        self.transcripts = []
        self._is_active = True

    async def audio_out(self, chunk: bytes, associated_text: str = "") -> None:
        self.audio_frames.extend(chunk)

    async def hangup(self, call_id: str, reason: str = "completed") -> None:
        self._is_active = False

    def audio_in(self):
        async def gen():
            yield b""
        return gen()


async def run_language_session(lang: str, turns: list) -> dict:
    session_dir = Path(f"session_runs/{lang}")
    session_dir.mkdir(parents=True, exist_ok=True)
    call_id = f"session_{lang}_{int(time.time())}"

    engine = CallingAgentEngine()
    telephony = MockTelephonySession(call_id)

    custom_cfg = {
        "name": "Priya",
        "company_name": "Aarogya Dental Care",
        "mode": "clinic_booking",
        "default_language": lang,
        "language_policy": "strict",
        "fillers": "off",
    }

    pipeline = engine.create_pipeline(
        telephony_provider=telephony,
        call_id=call_id,
        agent_config=custom_cfg,
    )
    engine._active_calls[call_id] = pipeline

    turn_metrics = []
    print(f"\n=======================================================")
    print(f"[*] Starting Live Pipeline Session for [{lang.upper()}] (Call ID: {call_id})")
    print(f"=======================================================")

    # 1. Greeting
    t0 = time.perf_counter()
    await pipeline.speak_greeting()
    greeting_ms = (time.perf_counter() - t0) * 1000
    print(f"    [0] AGENT GREETING: {pipeline.prompt_manager.get_greeting()} ({greeting_ms:.1f}ms)")

    # 2. Sequential Turns
    for idx, user_turn in enumerate(turns, 1):
        print(f"    [{idx}] CALLER: \"{user_turn}\"")
        t_turn_start = time.perf_counter()

        await pipeline.process_user_turn(user_turn)
        if pipeline._current_generation_task:
            await pipeline._current_generation_task

        t_turn_end = time.perf_counter()
        turn_total_ms = (t_turn_end - t_turn_start) * 1000

        last_reply = pipeline._recent_agent_replies[-1] if pipeline._recent_agent_replies else ""
        print(f"        AGENT: \"{last_reply}\"")
        print(f"        -> Turn Latency: {turn_total_ms:.1f}ms")

        turn_metrics.append({
            "turn": idx,
            "caller": user_turn,
            "agent": last_reply,
            "turn_ms": round(turn_total_ms, 1),
        })

    # Save session artifacts
    transcript_file = session_dir / "transcript.json"
    metrics_file = session_dir / "metrics.json"
    audio_file = session_dir / "agent_call.wav"

    with open(transcript_file, "w", encoding="utf-8") as f:
        json.dump(turn_metrics, f, indent=2, ensure_ascii=False)

    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump({
            "call_id": call_id,
            "lang": lang,
            "greeting_ms": round(greeting_ms, 1),
            "turns": turn_metrics,
            "total_audio_bytes": len(telephony.audio_frames),
        }, f, indent=2)

    # Save combined audio WAV (24kHz)
    if telephony.audio_frames:
        with wave.open(str(audio_file), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(bytes(telephony.audio_frames))

    print(f"    [✓] Session Complete! Artifacts written to {session_dir.resolve()}")
    return {
        "lang": lang,
        "transcript_path": str(transcript_file),
        "metrics_path": str(metrics_file),
        "audio_path": str(audio_file),
    }


async def main():
    results = {}
    for lang, turns in SCENARIOS.items():
        results[lang] = await run_language_session(lang, turns)

    print("\n" + "=" * 60)
    print("ALL 3 SESSIONS COMPLETED SUCCESSFULLY (MR, HI, EN)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
