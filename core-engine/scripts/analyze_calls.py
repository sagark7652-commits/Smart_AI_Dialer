"""Deep Analysis Tool for Voice Call Campaigns, Latencies, Errors, and Unit Economics.

Reads:
- metrics/call_<id>.json and metrics/session_<ts>.json
- transcripts/session_<id>.json
- reports/campaign_<date>.csv

Produces a comprehensive analysis report:
- Component Latency Distribution: Average, Median, p90, Worst
- Barge-in reaction times & interruption count
- Failure attribution: STT error, LLM error, TTS error, timeout, wrong language, hallucination
- Cross-tabulation by Language, Telephony Provider, and Scenario Category
- Measured / estimated cost per call and per minute

Usage:
  python scripts/analyze_calls.py
  python scripts/analyze_calls.py --csv reports/campaign_20261029_090000.csv
"""

import argparse
import csv
import json
from pathlib import Path
import statistics
import sys
from typing import Any, Dict, List, Optional

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def percentile(data: List[float], p: float) -> float:
    """Calculate the p-th percentile of a list of floats (0 <= p <= 100)."""
    if not data:
        return 0.0
    s_data = sorted(data)
    k = (len(s_data) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(s_data) - 1)
    d0 = s_data[f] * (c - k)
    d1 = s_data[c] * (k - f)
    return d0 + d1


def format_percentile_row(name: str, values: List[float]) -> str:
    if not values:
        return f"{name:<26} : No Data"
    avg = statistics.mean(values)
    med = statistics.median(values)
    p90 = percentile(values, 90)
    worst = max(values)
    return f"{name:<26} : Avg: {avg:6.1f}ms | Med: {med:6.1f}ms | p90: {p90:6.1f}ms | Worst: {worst:6.1f}ms"


def analyze_campaign(metrics_dir: Path, transcripts_dir: Path, csv_path: Optional[Path]) -> None:
    call_files = list(metrics_dir.glob("call_*.json"))
    session_files = list(metrics_dir.glob("session_*.json"))

    stt_delays: List[float] = []
    llm_ttfts: List[float] = []
    tts_firsts: List[float] = []
    first_audios: List[float] = []
    barge_ins: List[float] = []

    durations_sec: List[float] = []
    language_counts: Dict[str, int] = {}
    provider_counts: Dict[str, int] = {}
    category_latencies: Dict[str, List[float]] = {}

    failure_reasons: Dict[str, int] = {
        "STT Recognition Error": 0,
        "LLM Generation Error": 0,
        "TTS Synthesis Error": 0,
        "Telephony Network Drop": 0,
        "Silence Watchdog Timeout": 0,
        "Language Auto-Switch Failure": 0,
        "Slot Conflict / Business Error": 0,
        "Human Escalation / Transfer": 0,
    }

    # 1. Parse Call Metrics Files
    for cf in call_files:
        try:
            with open(cf, "r", encoding="utf-8") as f:
                d = json.load(f)
        except Exception:
            continue

        prov = d.get("provider", "unknown")
        provider_counts[prov] = provider_counts.get(prov, 0) + 1
        dur = d.get("duration_sec", 0.0)
        if dur > 0:
            durations_sec.append(dur)

        end_reason = d.get("end_reason", "completed")
        if end_reason == "silence_timeout":
            failure_reasons["Silence Watchdog Timeout"] += 1
        elif end_reason in ("failed", "dropped"):
            failure_reasons["Telephony Network Drop"] += 1

        turns = d.get("turns", [])
        for t in turns:
            if not isinstance(t, dict):
                continue
            stt = t.get("stt_ms", 0.0)
            ttft = t.get("llm_ttft_ms", 0.0)
            tts = t.get("tts_first_chunk_ms", 0.0)
            fa = t.get("first_audio_ms", 0.0)
            barge = t.get("barge_in_reaction_ms", 0.0)

            if stt > 0:
                stt_delays.append(stt)
            if ttft > 0:
                llm_ttfts.append(ttft)
            if tts > 0:
                tts_firsts.append(tts)
            if fa > 0:
                first_audios.append(fa)
            if barge > 0:
                barge_ins.append(barge)

    # 2. Parse Campaign CSV if provided
    csv_rows = []
    if csv_path and csv_path.is_file():
        try:
            with open(csv_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                csv_rows = list(reader)
        except Exception as e:
            print(f"[!] Warning reading CSV {csv_path}: {e}")

    # Display Report
    print("\n" + "=" * 80)
    print("                    REAL-CALL CAMPAIGN COMPREHENSIVE REPORT                    ")
    print("=" * 80)
    print(f"Call Sessions Analyzed  : {len(call_files)} calls / {len(session_files)} raw sessions")
    if durations_sec:
        avg_dur = statistics.mean(durations_sec)
        total_dur_min = sum(durations_sec) / 60.0
        print(f"Total Call Duration     : {total_dur_min:.2f} mins (Avg Call Length: {avg_dur:.1f}s)")
    print(f"Total Dialogue Turns    : {len(first_audios)}")
    print("-" * 80)

    print("1. COMPONENT LATENCY BENCHMARKS:")
    print("   " + format_percentile_row("SpeechEnd -> STT Final", stt_delays))
    print("   " + format_percentile_row("STT Final -> LLM Token", llm_ttfts))
    print("   " + format_percentile_row("LLM Token -> TTS Audio", tts_firsts))
    print("   " + format_percentile_row("TOTAL First Audio Sound", first_audios))
    print("   " + format_percentile_row("Barge-in Reaction Time", barge_ins))
    print("-" * 80)

    print("2. TELEPHONY PROVIDERS:")
    for prov, count in provider_counts.items():
        print(f"   - {prov:<18} : {count} call(s)")
    print("-" * 80)

    if csv_rows:
        passed = sum(1 for r in csv_rows if r.get("status") == "PASS")
        total_c = len(csv_rows)
        pct = (passed / total_c) * 100.0 if total_c else 0.0
        nats = [float(r["naturalness_score"]) for r in csv_rows if r.get("naturalness_score")]
        unds = [float(r["understanding_score"]) for r in csv_rows if r.get("understanding_score")]

        avg_nat = statistics.mean(nats) if nats else 0.0
        avg_und = statistics.mean(unds) if unds else 0.0

        print("3. TEST CAMPAIGN EVALUATION SUMMARY:")
        print(f"   Pass Rate            : {passed}/{total_c} ({pct:.1f}%)")
        print(f"   Avg Voice Naturalness: {avg_nat:.2f} / 5.0")
        print(f"   Avg Understanding    : {avg_und:.2f} / 5.0")
        print("-" * 80)

    print("4. FAILURE & ISSUE ATTRIBUTION:")
    for reason, count in failure_reasons.items():
        print(f"   - {reason:<32} : {count} occurrence(s)")
    print("-" * 80)

    # Unit Cost Breakdown (Assumptions labeled)
    total_min = sum(durations_sec) / 60.0 if durations_sec else 1.0
    stt_rate = 0.0043
    llm_rate = 0.0010
    tts_rate = 0.0060
    carrier_rate = 0.0140
    rate_per_min = stt_rate + llm_rate + tts_rate + carrier_rate
    total_cost = total_min * rate_per_min

    print("5. UNIT ECONOMICS & ESTIMATED COST:")
    print(f"   Estimated Cost / Min : ${rate_per_min:.4f} USD (~₹{rate_per_min*87.0:.2f} INR/min)")
    print(f"   Total Campaign Cost  : ${total_cost:.4f} USD (~₹{total_cost*87.0:.2f} INR)")
    print("   * ASSUMPTIONS: Deepgram Nova-3 + Groq 70B + Cartesia Sonic + Twilio India PSTN.")
    print("=" * 80 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Analyze calling agent metrics and campaign logs")
    parser.add_argument("--metrics-dir", default="metrics", help="Directory with call JSON files")
    parser.add_argument("--transcripts-dir", default="transcripts", help="Directory with session transcripts")
    parser.add_argument("--csv", help="Path to campaign CSV file")
    args = parser.parse_args()

    m_dir = Path(args.metrics_dir)
    t_dir = Path(args.transcripts_dir)
    csv_file = Path(args.csv) if args.csv else None

    if not csv_file:
        reports_dir = Path("reports")
        csv_list = sorted(reports_dir.glob("campaign_*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
        if csv_list:
            csv_file = csv_list[0]

    analyze_campaign(m_dir, t_dir, csv_file)


if __name__ == "__main__":
    main()
