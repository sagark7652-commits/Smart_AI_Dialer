"""Entry point for the Core AI Calling Agent Engine."""

import argparse
import asyncio
import sys
from agent.config import get_settings
from agent.languages import SUPPORTED_LANGUAGES, get_language
from agent.llm.groq_llm import GroqLLM
from agent.llm.prompt_manager import AgentPromptManager
from agent.logger import setup_logger
from agent.pipeline import VoicePipeline
from agent.stt.audio_capture import MicrophoneCapture
from agent.stt.deepgram_stt import DeepgramSTT
from agent.tts.factory import get_tts_provider
from agent.tts.player import AudioPlayer

logger = setup_logger("main")


def print_system_status() -> None:
    """Print sanitized engine status and configuration."""
    settings = get_settings()
    logger.info("Starting Core AI Calling Agent Engine...")
    logger.info("Environment: %s", settings.app_env)
    logger.info("Configured STT Provider: %s", settings.stt_provider)
    logger.info("Configured LLM Provider: %s", settings.llm_provider)
    logger.info("Configured TTS Provider: %s", settings.tts_provider)
    logger.info("Configured Telephony Provider: %s", settings.telephony_provider)

    logger.info(
        "Supported Languages: %s",
        ", ".join([f"{k} ({v.name})" for k, v in SUPPORTED_LANGUAGES.items()]),
    )


async def run_local_voice_loop(
    agent_config: str = "agent_config.yaml",
    debug: bool = False,
    simulate_phone: bool = False,
) -> None:
    """Execute full local mic -> STT -> LLM -> TTS -> speaker voice loop."""
    print("\n" + "=" * 65)
    print("🎙️  CORE AI CALLING AGENT: LOCAL VOICE LOOP (DAY 1 & 2)")
    print(f"   Config: {agent_config} | Phone Audio Sim: {simulate_phone} | Debug: {debug}")
    print("   Press Ctrl+C to stop session and view latency summary.")
    print("=" * 65 + "\n")

    prompt_manager = AgentPromptManager(config_path=agent_config)
    stt = DeepgramSTT(sample_rate=16000)
    llm = GroqLLM()
    tts = get_tts_provider()
    player = AudioPlayer()
    capture = MicrophoneCapture(
        sample_rate=16000,
        chunk_ms=25,
        simulate_phone=simulate_phone,
    )

    pipeline = VoicePipeline(
        stt=stt,
        llm=llm,
        tts=tts,
        player=player,
        prompt_manager=prompt_manager,
        debug=debug,
    )

    try:
        capture.start()
        await stt.start(language=prompt_manager.config.get("default_language", "multi"))
        logger.info("Local voice loop initialized. Listening on microphone...")
        await pipeline.run_loop(capture.stream_chunks())
    except KeyboardInterrupt:
        print("\n\nSession terminated by user (Ctrl+C). Finalizing...")
    except Exception as e:
        logger.error(f"Voice loop error: {e}")
    finally:
        capture.stop()
        await stt.stop()
        player.close()
        transcript_path = pipeline.save_session_transcript()
        print(f"\n📁 Session transcript saved: {transcript_path}")
        pipeline.print_session_summary()


def main() -> None:
    """Parse CLI arguments and dispatch execution mode."""
    parser = argparse.ArgumentParser(
        description="Core AI Calling Agent Engine CLI",
    )
    parser.add_argument(
        "--mode",
        choices=["local", "status"],
        default="status" if len(sys.argv) == 1 else "local",
        help="Execution mode ('local' for full voice loop, 'status' for configuration check).",
    )
    parser.add_argument(
        "--agent",
        default="agent_config.yaml",
        help="Path to agent configuration YAML file.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Display real-time interim STT transcripts and debug logs.",
    )
    parser.add_argument(
        "--phone",
        action="store_true",
        help="Simulate 8kHz telephony audio downsampling and upsampling.",
    )

    args = parser.parse_args()

    if args.mode == "status" and len(sys.argv) <= 2 and not args.debug and not args.phone:
        print_system_status()
        assert get_language("hindi") is not None, "Hindi must be configured"
        assert get_language("marathi") is not None, "Marathi must be configured"
        assert get_language("english") is not None, "English must be configured"
        logger.info("Step 1 setup verified successfully.")
    else:
        asyncio.run(
            run_local_voice_loop(
                agent_config=args.agent,
                debug=args.debug,
                simulate_phone=args.phone,
            )
        )


if __name__ == "__main__":
    main()
