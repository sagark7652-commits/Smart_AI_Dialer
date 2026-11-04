"""Step 5 Runner: Full local voice loop (Mic -> STT -> LLM -> TTS -> Speaker) with VAD & Barge-in."""

import argparse
import asyncio
import sys
from agent.config import get_settings
from agent.llm.groq_llm import GroqLLM
from agent.llm.prompt_manager import AgentPromptManager
from agent.pipeline import AgentState, VoicePipeline
from agent.stt.audio_capture import MicrophoneCapture
from agent.stt.deepgram_stt import DeepgramSTT
from agent.tts.factory import get_tts_provider
from agent.tts.player import AudioPlayer


async def run_voice_loop(simulate_phone: bool = False) -> None:
    settings = get_settings()

    # Pre-flight check
    if not settings.groq_api_key or not settings.deepgram_api_key:
        print("\n" + "=" * 65)
        print("ERROR: Missing required API keys in .env:")
        if not settings.groq_api_key:
            print("- GROQ_API_KEY")
        if not settings.deepgram_api_key:
            print("- DEEPGRAM_API_KEY")
        print("=" * 65 + "\n")
        sys.exit(1)

    mode_label = "8kHz Simulated Telephony" if simulate_phone else "16kHz Wideband Audio"
    print("\n" + "=" * 65)
    print("      AI CALLING AGENT - STEP 5 (FULL LOCAL VOICE LOOP)      ")
    print(f" Mode: {mode_label} | TTS Provider: {settings.tts_provider.upper()}")
    print("=" * 65)

    prompt_manager = AgentPromptManager()
    stt = DeepgramSTT(sample_rate=16000)
    llm = GroqLLM()
    tts = get_tts_provider()
    player = AudioPlayer()
    capture = MicrophoneCapture(sample_rate=16000, chunk_ms=40, simulate_phone=simulate_phone)

    pipeline = VoicePipeline(
        stt=stt,
        llm=llm,
        tts=tts,
        player=player,
        prompt_manager=prompt_manager,
        silence_timeout_sec=10.0,
        second_silence_timeout_sec=8.0,
        end_of_turn_silence_ms=700,
    )

    def on_state_change(new_state: AgentState) -> None:
        color = {
            AgentState.LISTENING: "\033[94m",  # Blue
            AgentState.THINKING: "\033[93m",   # Yellow
            AgentState.SPEAKING: "\033[92m",   # Green
            AgentState.DISCONNECTED: "\033[91m",# Red
        }.get(new_state, "\033[0m")
        print(f"\r\033[K{color}● State: {new_state.value}\033[0m")

    pipeline.on_state_change = on_state_change

    try:
        capture.start()
        await stt.start(language="multi")
    except Exception as e:
        print(f"\n[Hardware/STT Connection Error]: {e}")
        capture.stop()
        player.close()
        return

    print("\n[Voice Pipeline Live]")
    print("- Talk freely into your mic in Hindi, English, Marathi, or Hinglish.")
    print("- Test barge-in: Interrupt the agent mid-sentence; speech will stop immediately.")
    print("- Test silence: Stay silent for 10s to see the agent ask 'Are you there?'.")
    print("- Press Ctrl+C at any time to exit and save transcript.\n" + "-" * 65)

    try:
        await pipeline.run_loop(capture.stream_chunks())
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\nShutting down voice pipeline...")
    finally:
        capture.stop()
        await stt.stop()
        player.clear()
        player.close()
        print("\nSession finished cleanly.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Full local voice loop with VAD and Barge-in.")
    parser.add_argument(
        "--phone",
        action="store_true",
        help="Simulate 8kHz telephone network audio degradation.",
    )
    args = parser.parse_args()
    asyncio.run(run_voice_loop(simulate_phone=args.phone))


if __name__ == "__main__":
    main()
