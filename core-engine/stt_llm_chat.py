"""Voice-in, text-out test harness: Microphone -> Streaming STT -> LLM streaming text."""

import argparse
import asyncio
import sys
import time
from agent.config import get_settings
from agent.llm.groq_llm import GroqLLM
from agent.llm.prompt_manager import AgentPromptManager, ConversationSession
from agent.stt.audio_capture import MicrophoneCapture
from agent.stt.deepgram_stt import DeepgramSTT


async def run_voice_input_chat(simulate_phone: bool = False) -> None:
    settings = get_settings()

    if not settings.deepgram_api_key or not settings.groq_api_key:
        print("\n" + "=" * 60)
        print("ERROR: Both DEEPGRAM_API_KEY and GROQ_API_KEY must be set in .env:")
        print("DEEPGRAM_API_KEY=your_deepgram_key")
        print("GROQ_API_KEY=your_groq_key")
        print("=" * 60 + "\n")
        sys.exit(1)

    mode_label = "8kHz Phone Audio Simulation" if simulate_phone else "16kHz Wideband Microphone"
    print("\n" + "=" * 65)
    print(f"       AI CALLING AGENT - STEP 4 (STREAMING STT -> LLM)       ")
    print(f" Mode: {mode_label}")
    print("=" * 65)

    prompt_manager = AgentPromptManager()
    session = ConversationSession(prompt_manager)
    llm = GroqLLM()

    # Audio capture & STT setup
    capture = MicrophoneCapture(sample_rate=16000, chunk_ms=40, simulate_phone=simulate_phone)
    stt = DeepgramSTT(sample_rate=16000)

    try:
        capture.start()
    except RuntimeError as e:
        print(f"\n[Audio Hardware Error]: {e}")
        return

    try:
        await stt.start(language="multi")
    except Exception as e:
        print(f"\n[STT Connection Error]: {e}")
        capture.stop()
        return

    # Print greeting
    greeting = session.get_greeting()
    print(f"\nAgent (Priya): {greeting}\n")
    print("Speak naturally in Hindi, English, Marathi, or Hinglish.")
    print("Say 'exit' or press Ctrl+C to terminate.\n" + "-" * 65)

    # Audio forwarding task
    async def forward_mic_to_stt():
        try:
            async for chunk in capture.stream_chunks():
                await stt.send_audio(chunk)
        except asyncio.CancelledError:
            pass
        except Exception as err:
            sys.stdout.write(f"\n[Mic forwarding error]: {err}\n")

    audio_task = asyncio.create_task(forward_mic_to_stt())

    try:
        async for event in stt.stream_events():
            if not event.is_final:
                # Show live interim transcription
                sys.stdout.write(f"\r\033[K\033[90m[Listening]: {event.text}\033[0m")
                sys.stdout.flush()
                continue

            user_text = event.text.strip()
            if not user_text:
                continue

            latency_str = (
                f"{event.latency_ms:.1f}ms" if event.latency_ms is not None else "N/A"
            )

            # Display final user transcript
            sys.stdout.write(f"\r\033[K\n\033[1mYou: {user_text}\033[0m")
            sys.stdout.write(f"  \033[90m[STT Latency: {latency_str}]\033[0m\n")
            sys.stdout.flush()

            if user_text.lower() in ["exit", "quit", "exit.", "quit."]:
                print("\nExiting session. Dhanyavaad!")
                break

            # Forward to LLM
            session.add_user_message(user_text)

            sys.stdout.write("Agent: ")
            sys.stdout.flush()

            llm_start = time.perf_counter()
            first_token = True
            ttft_ms = 0.0
            full_reply = []

            try:
                async for token in llm.generate_stream(
                    messages=session.get_history(),
                    system_prompt=session.system_prompt,
                ):
                    if first_token:
                        ttft_ms = (time.perf_counter() - llm_start) * 1000
                        first_token = False
                    sys.stdout.write(token)
                    sys.stdout.flush()
                    full_reply.append(token)

                agent_reply = "".join(full_reply).strip()
                session.add_assistant_message(agent_reply)
                total_duration = time.perf_counter() - llm_start
                sys.stdout.write(
                    f"\n\033[90m[LLM TTFT: {ttft_ms:.1f}ms | Total LLM Time: {total_duration:.2f}s]\033[0m\n\n"
                )
                sys.stdout.flush()

            except Exception as llm_err:
                sys.stdout.write(f"\n[LLM Error: {llm_err}]\n")

    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    finally:
        audio_task.cancel()
        capture.stop()
        await stt.stop()
        print("Session ended clean.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Live microphone STT to streaming LLM chat.")
    parser.add_argument(
        "--phone",
        action="store_true",
        help="Simulate 8kHz telephone network audio degradation.",
    )
    args = parser.parse_args()
    asyncio.run(run_voice_input_chat(simulate_phone=args.phone))


if __name__ == "__main__":
    main()
