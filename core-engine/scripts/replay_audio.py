"""Offline Audio Replay & Bug Reproduction Tool.

Takes a recorded caller.wav file and streams it through the local VoicePipeline
(STT -> LLM -> TTS -> AudioPlayer) in 25ms frames, exactly simulating a live call.

Usage:
  python scripts/replay_audio.py recordings/call_123_caller.wav [--agent agent_config.yaml]
"""

import argparse
import asyncio
from pathlib import Path
import sys
import wave

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.llm.groq_llm import GroqLLM
from agent.llm.prompt_manager import AgentPromptManager
from agent.logger import setup_logger
from agent.pipeline import VoicePipeline
from agent.stt.deepgram_stt import DeepgramSTT
from agent.tts.factory import get_tts_provider
from agent.tts.player import AudioPlayer

logger = setup_logger("replay")

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def stream_wav_file(wav_path: Path, chunk_ms: int = 25):
    """Yield audio chunks from WAV file at realistic real-time pace."""
    with wave.open(str(wav_path), "rb") as wf:
        rate = wf.getframerate()
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        chunk_frames = int(rate * (chunk_ms / 1000.0))

        logger.info(f"Streaming {wav_path.name}: {rate}Hz, {channels}ch, chunk={chunk_frames} frames ({chunk_ms}ms)")

        while True:
            raw = wf.readframes(chunk_frames)
            if not raw:
                break
            yield raw
            # Real-time pacing simulation
            await asyncio.sleep(chunk_ms / 1000.0)


async def replay_session(wav_path: Path, agent_config: str = "agent_config.yaml") -> None:
    print("\n" + "=" * 70)
    print("                 OFFLINE AUDIO REPLAY & DEBUG REPRODUCER                ")
    print(f" Source Audio : {wav_path.resolve()}")
    print(f" Agent Config : {agent_config}")
    print("=" * 70 + "\n")

    prompt_mgr = AgentPromptManager(config_path=agent_config)
    stt = DeepgramSTT(sample_rate=16000)
    llm = GroqLLM()
    tts = get_tts_provider()
    player = AudioPlayer()

    call_id = f"replay_{wav_path.stem}"
    pipeline = VoicePipeline(
        stt=stt,
        llm=llm,
        tts=tts,
        player=player,
        prompt_manager=prompt_mgr,
        call_id=call_id,
        debug=True,
    )

    try:
        await stt.start(language=prompt_mgr.config.get("default_language", "multi"))
        logger.info("Pipeline ready. Feeding recorded audio stream...")
        await pipeline.run_loop(stream_wav_file(wav_path, chunk_ms=25))
    except Exception as e:
        logger.error(f"Error during audio replay: {e}")
    finally:
        await stt.stop()
        player.close()
        saved_t = pipeline.save_session_transcript()
        print(f"\n[+] Replay transcript saved to: {saved_t}")
        pipeline.print_session_summary()


def main():
    parser = argparse.ArgumentParser(description="Replay recorded caller WAV audio offline")
    parser.add_argument("wav_file", help="Path to caller .wav recording")
    parser.add_argument("--agent", default="agent_config.yaml", help="Agent YAML configuration file")
    args = parser.parse_args()

    wav_file = Path(args.wav_file)
    if not wav_file.is_file():
        print(f"[!] WAV file not found: {args.wav_file}")
        sys.exit(1)

    asyncio.run(replay_session(wav_file, args.agent))


if __name__ == "__main__":
    main()
