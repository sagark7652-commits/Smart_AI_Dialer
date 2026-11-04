"""Summarize voice loop and telephony metrics across JSON session reports.

Calculates and displays average, median, best, and worst percentiles for:
- Speech End to STT Final (STT latency)
- STT Final to LLM First Token (LLM TTFT)
- LLM Token to TTS First Chunk (TTS synthesis latency)
- Total to First Agent Sound (First-audio latency)
- Barge-in reaction time and interruption count

Usage:
  python scripts/summarize_metrics.py [--dir metrics] [--file metrics/call_123.json]
"""

import argparse
import json
from pathlib import Path
import statistics
import sys
from typing import Any, Dict, List

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def format_stats(values: List[float]) -> str:
    if not values:
        return "N/A"
    avg = statistics.mean(values)
    med = statistics.median(values)
    worst = max(values)
    best = min(values)
    return f"Avg: {avg:6.1f}ms | Med: {med:6.1f}ms | Best: {best:6.1f}ms | Worst: {worst:6.1f}ms"


def summarize_metrics(metrics_files: List[Path]) -> None:
    if not metrics_files:
        print("[!] No metrics JSON files found.")
        return

    all_stt: List[float] = []
    all_ttft: List[float] = []
    all_tts: List[float] = []
    all_first_audio: List[float] = []
    all_barge_in: List[float] = []

    total_sessions = len(metrics_files)
    total_turns = 0
    total_interruptions = 0

    for path in metrics_files:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            continue

        # Extract turns
        turns = data.get("turns") or data.get("turn_latencies") or []
        total_turns += len(turns)
        total_interruptions += data.get("barge_in_count", 0)

        for turn in turns:
            if not isinstance(turn, dict):
                continue
            stt = turn.get("stt_ms") or turn.get("speech_end_to_stt_final_ms", 0.0)
            ttft = turn.get("llm_ttft_ms") or turn.get("llm_first_token_ms", 0.0)
            tts = turn.get("tts_first_chunk_ms", 0.0)
            first_aud = turn.get("first_audio_ms") or turn.get("total_to_first_agent_sound_ms", 0.0)
            barge = turn.get("barge_in_reaction_ms", 0.0)

            if stt > 0:
                all_stt.append(stt)
            if ttft > 0:
                all_ttft.append(ttft)
            if tts > 0:
                all_tts.append(tts)
            if first_aud > 0:
                all_first_audio.append(first_aud)
            if barge > 0:
                all_barge_in.append(barge)

    print("\n" + "=" * 78)
    print("                VOICE CALL ENGINE: AGGREGATED METRICS SUMMARY              ")
    print("=" * 78)
    print(f"Files Analyzed        : {total_sessions} session(s)")
    print(f"Total Dialogue Turns  : {total_turns}")
    print(f"Total Interruptions   : {total_interruptions}")
    print("-" * 78)
    print(f"1. SpeechEnd -> STT   : {format_stats(all_stt)}")
    print(f"2. STT -> LLM First   : {format_stats(all_ttft)}")
    print(f"3. LLM -> TTS First   : {format_stats(all_tts)}")
    print(f"4. TOTAL First Audio  : {format_stats(all_first_audio)}")
    print(f"5. Barge-In Reaction  : {format_stats(all_barge_in)}")
    print("=" * 78 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Summarize calling agent latency metrics")
    parser.add_argument("--dir", default="metrics", help="Directory containing metrics JSON files")
    parser.add_argument("--file", help="Specific metrics JSON file to inspect")
    args = parser.parse_args()

    if args.file:
        files = [Path(args.file)]
    else:
        metric_dir = Path(args.dir)
        files = list(metric_dir.glob("*.json"))

    summarize_metrics(files)


if __name__ == "__main__":
    main()
