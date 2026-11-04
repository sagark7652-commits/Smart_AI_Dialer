"""Load Testing Tool: Simulates 50+ concurrent calls to test throughput and latency."""

import argparse
import asyncio
import sys
import time
from typing import Dict, List
import statistics

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from agent.concurrency import ConcurrencyManager
from agent.cost_calculator import CostCalculator
from agent.llm.base import BaseLLM, ChatMessage
from agent.llm.prompt_manager import AgentPromptManager
from agent.pipeline import AgentState, VoicePipeline
from agent.tts.base import BaseTTS


class MockLoadLLM(BaseLLM):
    async def generate_stream(self, messages, system_prompt, tools=None):
        # Simulate ~200ms processing
        await asyncio.sleep(0.18)
        yield "Welcome to Aarogya Dental Care. How can I help you today?"


class MockLoadTTS(BaseTTS):
    async def generate_audio_stream(self, text, voice_id=None, language="hi"):
        # Yield 320-byte chunk after 100ms
        await asyncio.sleep(0.08)
        yield b"\x00" * 320


async def simulate_call(
    call_idx: int,
    concurrency_mgr: ConcurrencyManager,
    prompt_manager: AgentPromptManager,
) -> Dict[str, float]:
    call_id = f"load_call_{call_idx}_{int(time.time()*1000)}"
    t0 = time.perf_counter()

    try:
        # Acquire concurrency slot
        await concurrency_mgr.acquire_slot(timeout_sec=5.0)
    except Exception as e:
        return {"call_id": call_id, "success": 0.0, "latency_ms": 0.0, "error": str(e)}

    try:
        pipeline = VoicePipeline(
            llm=MockLoadLLM(),
            tts=MockLoadTTS(),
            prompt_manager=prompt_manager,
            call_id=call_id,
        )
        # Simulate caller speaking a turn
        await pipeline._generate_and_speak(
            user_text="What are your clinic hours?",
            detected_lang="en",
            speech_end_time=t0,
            stt_latency_ms=120.0,
        )
        total_latency_ms = (time.perf_counter() - t0) * 1000
        return {"call_id": call_id, "success": 1.0, "latency_ms": total_latency_ms, "error": None}

    finally:
        concurrency_mgr.release_slot()


async def run_load_test(total_calls: int = 50, max_concurrency: int = 20):
    concurrency_mgr = ConcurrencyManager(
        max_concurrent_calls=max_concurrency,
        max_queue_size=100,
    )
    prompt_manager = AgentPromptManager()

    print(f"\n=======================================================")
    print(f"  LAUNCHING LOAD TEST: {total_calls} CALLS | MAX CONCURRENCY: {max_concurrency}")
    print(f"=======================================================\n")

    t_start = time.perf_counter()
    tasks = [simulate_call(i, concurrency_mgr, prompt_manager) for i in range(total_calls)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    t_end = time.perf_counter()

    duration = t_end - t_start
    valid_results = [r for r in results if isinstance(r, dict)]
    successful = [r for r in valid_results if r.get("success") == 1.0]
    latencies = [r["latency_ms"] for r in successful]

    success_count = len(successful)
    fail_count = total_calls - success_count
    throughput = success_count / duration if duration > 0 else 0.0

    p50 = statistics.median(latencies) if latencies else 0.0
    p95 = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else (max(latencies) if latencies else 0.0)

    print(f"Results Summary:")
    print(f"  Total Calls:      {total_calls}")
    print(f"  Successful:       {success_count} ({(success_count/total_calls)*100:.1f}%)")
    print(f"  Failed/Dropped:   {fail_count}")
    print(f"  Total Duration:   {duration:.2f}s")
    print(f"  Throughput:       {throughput:.2f} calls/sec")
    print(f"  Latency p50:      {p50:.1f}ms")
    print(f"  Latency p95:      {p95:.1f}ms")
    print(f"=======================================================\n")

    return {
        "total_calls": total_calls,
        "successful": success_count,
        "failed": fail_count,
        "duration_sec": duration,
        "throughput_calls_per_sec": throughput,
        "p50_latency_ms": p50,
        "p95_latency_ms": p95,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voice Calling Engine Load Testing")
    parser.add_argument("--calls", type=int, default=50, help="Total number of simulated calls")
    parser.add_argument("--concurrency", type=int, default=20, help="Max concurrency limit")
    args = parser.parse_args()

    asyncio.run(run_load_test(total_calls=args.calls, max_concurrency=args.concurrency))
