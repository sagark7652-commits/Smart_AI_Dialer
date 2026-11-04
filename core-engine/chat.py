"""Interactive terminal chat with streaming LLM and real-time TTS voice playback."""

import asyncio
import sys
import time
from agent.config import get_settings
from agent.languages import detect_language
from agent.llm.groq_llm import GroqLLM
from agent.llm.prompt_manager import AgentPromptManager, ConversationSession
from agent.tts.chunker import SentenceChunker
from agent.tts.factory import get_tts_provider
from agent.tts.player import AudioPlayer
from agent.tts.normalizer import TextNormalizer


async def stream_and_speak_turn(
    llm: GroqLLM,
    tts,
    player: AudioPlayer,
    session: ConversationSession,
    user_input: str,
    detected_lang: str,
) -> None:
    """Stream LLM response, chunk sentences, synthesize TTS concurrently, and play on speaker."""
    session.add_user_message(user_input)

    sys.stdout.write("Agent: ")
    sys.stdout.flush()

    turn_start_time = time.perf_counter()
    ttft_ms: float = 0.0
    first_audio_ms: float = 0.0
    first_token = True

    # Register latency hook on player
    def on_first_audio() -> None:
        nonlocal first_audio_ms
        first_audio_ms = (time.perf_counter() - turn_start_time) * 1000

    player.on_first_audio = on_first_audio
    player.reset_first_audio_flag()

    chunker = SentenceChunker()
    full_response: list[str] = []
    sentence_queue: asyncio.Queue[str | None] = asyncio.Queue()

    # Background worker: takes sentence chunks and feeds TTS -> AudioPlayer
    async def tts_worker() -> None:
        while True:
            sentence = await sentence_queue.get()
            if sentence is None:
                sentence_queue.task_done()
                break

            normalized = TextNormalizer.normalize(sentence, language=detected_lang)
            if normalized.strip() and tts:
                try:
                    async for audio_chunk in tts.generate_audio_stream(
                        normalized, language=detected_lang
                    ):
                        player.enqueue(audio_chunk)
                except Exception as tts_err:
                    sys.stdout.write(f"\n[TTS Error: {tts_err}]\n")
            sentence_queue.task_done()

    tts_task = asyncio.create_task(tts_worker())

    try:
        async for token in llm.generate_stream(
            messages=session.get_history(),
            system_prompt=session.system_prompt,
        ):
            if first_token:
                ttft_ms = (time.perf_counter() - turn_start_time) * 1000
                first_token = False

            sys.stdout.write(token)
            sys.stdout.flush()
            full_response.append(token)

            # Check if token completed a sentence
            completed_sentences = chunker.add_token(token)
            for sentence in completed_sentences:
                await sentence_queue.put(sentence)

        # Flush any trailing sentence fragment
        for trailing in chunker.flush():
            await sentence_queue.put(trailing)

        # Signal tts_worker to finish
        await sentence_queue.put(None)
        await tts_task

    except Exception as e:
        sys.stdout.write(f"\n[LLM Error: {e}]\n")
        await sentence_queue.put(None)
        await tts_task

    total_duration_sec = time.perf_counter() - turn_start_time
    agent_text = "".join(full_response).strip()
    session.add_assistant_message(agent_text)

    # Allow audio to finish playing if user wants to listen
    player.wait_until_done(timeout=15.0)

    # Format latency display
    audio_latency_str = f"{first_audio_ms:.1f}ms" if first_audio_ms > 0 else "N/A (No audio/error)"
    sys.stdout.write(
        f"\n\033[90m[TTFT: {ttft_ms:.1f}ms | First Audio Latency: {audio_latency_str} | Total: {total_duration_sec:.2f}s | Lang: {detected_lang}]\033[0m\n"
    )
    sys.stdout.flush()


async def run_terminal_voice_chat() -> None:
    """Run interactive terminal chat with voice playback."""
    settings = get_settings()

    if not settings.groq_api_key:
        print("\n" + "=" * 60)
        print("ERROR: GROQ_API_KEY is not set.")
        print("Please add your key to .env:")
        print("GROQ_API_KEY=gsk_your_key_here")
        print("=" * 60 + "\n")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("      AI CALLING AGENT ENGINE - STEP 3 (LLM + TTS)      ")
    print("=" * 60)
    print(f"TTS Provider: {settings.tts_provider.upper()}")
    print("Initializing components...")

    prompt_manager = AgentPromptManager()
    session = ConversationSession(prompt_manager)
    llm = GroqLLM()

    # Initialize TTS provider
    tts = None
    try:
        tts = get_tts_provider()
    except Exception as e:
        print(f"[Warning] Could not initialize TTS provider: {e}")

    player = AudioPlayer()

    # Initial Greeting
    greeting = session.get_greeting()
    print(f"\nAgent (Priya): {greeting}")

    # Speak initial greeting
    if tts:
        try:
            greeting_norm = TextNormalizer.normalize(greeting, language="hi")
            async for chunk in tts.generate_audio_stream(greeting_norm, language="hi"):
                player.enqueue(chunk)
            player.wait_until_done(timeout=5.0)
        except Exception as e:
            print(f"[TTS Warning on greeting]: {e}")

    print("\nType your message in English, Hindi, Marathi, or Hinglish.")
    print("Type 'clear' or 'stop' to test barge-in audio clearing.")
    print("Type 'exit' to quit.\n" + "-" * 60)

    try:
        while True:
            try:
                user_input = input("\nYou: ").strip()
            except (KeyboardInterrupt, EOFError):
                break

            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit", "q"]:
                break
            if user_input.lower() in ["clear", "stop"]:
                player.clear()
                print("[Playback queue cleared (Barge-in)]")
                continue

            # Detect language for pronunciation
            lang = detect_language(user_input)

            # Barge-in: clear any still-playing previous audio
            player.clear()

            await stream_and_speak_turn(
                llm=llm,
                tts=tts,
                player=player,
                session=session,
                user_input=user_input,
                detected_lang=lang.short_code,
            )

    finally:
        player.clear()
        player.close()
        print("\nSession ended. Dhanyavaad!")


def main() -> None:
    asyncio.run(run_terminal_voice_chat())


if __name__ == "__main__":
    main()
