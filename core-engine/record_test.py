"""Quick 10-second microphone recording test to evaluate STT accuracy."""

import argparse
import asyncio
import sys
import time
from agent.config import get_settings
from agent.stt.audio_capture import MicrophoneCapture
from agent.stt.deepgram_stt import DeepgramSTT


async def record_and_transcribe(duration_sec: int = 10, simulate_phone: bool = False) -> None:
    settings = get_settings()
    if not settings.deepgram_api_key:
        print("\n" + "=" * 60)
        print("ERROR: DEEPGRAM_API_KEY is not set.")
        print("Please add your key to .env:")
        print("DEEPGRAM_API_KEY=your_key_here")
        print("=" * 60 + "\n")
        sys.exit(1)

    mode_label = "8kHz Simulated Phone Audio" if simulate_phone else "16kHz Wideband Audio"
    print("\n" + "=" * 60)
    print(f"  RECORDING TEST ({duration_sec}s) - Mode: {mode_label}  ")
    print("=" * 60)
    print("Speak in Hindi, English, Marathi, or Hinglish...")

    capture = MicrophoneCapture(sample_rate=16000, chunk_ms=40, simulate_phone=simulate_phone)
    stt = DeepgramSTT(sample_rate=16000)

    try:
        capture.start()
    except Exception as e:
        print(f"\n[Microphone Error]: {e}")
        return

    try:
        await stt.start(language="multi")
    except Exception as e:
        print(f"\n[STT Connection Error]: {e}")
        capture.stop()
        return

    final_transcripts = []
    start_time = time.time()
    last_interim = ""

    # Task to forward audio from mic to STT
    async def audio_sender():
        try:
            async for chunk in capture.stream_chunks():
                await stt.send_audio(chunk)
                if time.time() - start_time >= duration_sec:
                    break
        except Exception as err:
            print(f"\n[Audio sender error]: {err}")

    # Task to read transcriptions
    async def transcript_receiver():
        nonlocal last_interim
        async for event in stt.stream_events():
            if event.is_final:
                sys.stdout.write(f"\r\033[K[Final]: {event.text}\n")
                sys.stdout.flush()
                final_transcripts.append(event.text)
                last_interim = ""
            else:
                last_interim = event.text
                sys.stdout.write(f"\r\033[K\033[90m[Listening...]: {event.text}\033[0m")
                sys.stdout.flush()

    sender_task = asyncio.create_task(audio_sender())
    receiver_task = asyncio.create_task(transcript_receiver())

    # Wait for recording duration
    for remaining in range(duration_sec, 0, -1):
        if not sender_task.done():
            time.sleep(1)

    print(f"\nTime up ({duration_sec}s)! Finalizing transcription...")
    capture.stop()
    await sender_task

    # Allow brief window for final events
    await asyncio.sleep(1.0)
    await stt.stop()
    receiver_task.cancel()

    full_text = " ".join(final_transcripts).strip() or last_interim
    print("\n" + "-" * 60)
    print("RESULT TRANSCRIPT:")
    print(f"'{full_text}'" if full_text else "(No speech detected)")
    print("-" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description="Record 10s audio and print STT transcript.")
    parser.add_argument(
        "--phone",
        action="store_true",
        help="Simulate 8kHz telephone network audio degradation.",
    )
    parser.add_argument(
        "--seconds",
        type=int,
        default=10,
        help="Recording duration in seconds (default: 10).",
    )
    args = parser.parse_args()
    asyncio.run(record_and_transcribe(duration_sec=args.seconds, simulate_phone=args.phone))


if __name__ == "__main__":
    main()
