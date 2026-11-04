"""Audio Continuity Diagnostic Tool for PART H1.

Analyzes WAV recordings to detect:
1. Unnatural gaps (>250ms silence inside speech segments)
2. Boundary clicks / sample discontinuities (|s[i] - s[i-1]| > threshold)
3. Sudden volume / amplitude envelope jumps
4. Playback buffer underruns

Usage:
  python scripts/audio_continuity_check.py --input session_runs/mr/agent_call.wav
  python scripts/audio_continuity_check.py --dir recordings --report recordings/continuity_report_before.json
"""

import argparse
import json
from pathlib import Path
import sys
import wave
import numpy as np

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def analyze_wav_continuity(
    wav_path: Path,
    silence_threshold_ms: float = 250.0,
    silence_energy_floor: float = 80.0,
    click_delta_threshold: int = 4000,
) -> dict:
    """Analyze a single WAV file for gaps, clicks, and continuity defects."""
    if not wav_path.is_file() or wav_path.stat().st_size <= 44:
        return {
            "file": str(wav_path),
            "status": "empty_or_missing",
            "duration_sec": 0.0,
            "sample_rate": 0,
            "unnatural_gaps_count": 0,
            "worst_gap_ms": 0.0,
            "boundary_clicks_count": 0,
            "underruns_count": 0,
            "volume_jumps_count": 0,
        }

    with wave.open(str(wav_path), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        sr = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    if len(frames) == 0:
        return {
            "file": str(wav_path),
            "status": "empty",
            "duration_sec": 0.0,
            "sample_rate": sr,
            "unnatural_gaps_count": 0,
            "worst_gap_ms": 0.0,
            "boundary_clicks_count": 0,
            "underruns_count": 0,
            "volume_jumps_count": 0,
        }

    # Convert frames to 16-bit mono PCM array
    if sampwidth == 2:
        samples = np.frombuffer(frames, dtype=np.int16)
        if n_channels > 1:
            samples = samples[::n_channels]
    elif sampwidth == 1:
        # 8-bit unsigned
        raw8 = np.frombuffer(frames, dtype=np.uint8)
        samples = ((raw8.astype(np.int32) - 128) * 256).astype(np.int16)
    else:
        # 24-bit or 32-bit fallback
        samples = np.frombuffer(frames, dtype=np.int16)

    duration_sec = len(samples) / float(sr)

    # 1. Boundary Click Detection (|s[i] - s[i-1]| > threshold)
    diffs = np.abs(np.diff(samples.astype(np.int32)))
    click_indices = np.where(diffs > click_delta_threshold)[0]
    boundary_clicks_count = int(len(click_indices))

    # 2. Silence / Unnatural Gap Detection
    # Frame-based energy in 20ms windows
    window_samples = int(sr * 0.020)  # 20ms
    if window_samples <= 0:
        window_samples = 1

    n_windows = len(samples) // window_samples
    if n_windows == 0:
        return {
            "file": str(wav_path),
            "status": "too_short",
            "duration_sec": round(duration_sec, 2),
            "sample_rate": sr,
            "unnatural_gaps_count": 0,
            "worst_gap_ms": 0.0,
            "boundary_clicks_count": boundary_clicks_count,
            "underruns_count": 0,
            "volume_jumps_count": 0,
        }

    reshaped = samples[: n_windows * window_samples].reshape(n_windows, window_samples)
    rms_per_window = np.sqrt(np.mean(reshaped.astype(np.float32) ** 2, axis=1))

    # Detect speech active start and end
    speech_active = rms_per_window > silence_energy_floor
    speech_indices = np.where(speech_active)[0]

    unnatural_gaps = []
    underruns_count = 0

    if len(speech_indices) > 1:
        start_idx = speech_indices[0]
        end_idx = speech_indices[-1]

        # Analyze inner gaps within speech bounds
        active_region = rms_per_window[start_idx : end_idx + 1]
        silent_windows = 0

        for energy in active_region:
            if energy <= silence_energy_floor:
                silent_windows += 1
            else:
                if silent_windows > 0:
                    gap_duration_ms = silent_windows * 20.0
                    if gap_duration_ms >= silence_threshold_ms:
                        unnatural_gaps.append(gap_duration_ms)
                        # Gaps > 400ms indicate severe playback buffer starving / underrun
                        if gap_duration_ms > 400.0:
                            underruns_count += 1
                    silent_windows = 0

        if silent_windows > 0:
            gap_duration_ms = silent_windows * 20.0
            if gap_duration_ms >= silence_threshold_ms:
                unnatural_gaps.append(gap_duration_ms)

    worst_gap_ms = float(max(unnatural_gaps)) if unnatural_gaps else 0.0

    # 3. Volume Jump Detection (abrupt envelope change > 400% between consecutive active windows)
    vol_jumps = 0
    for i in range(1, len(rms_per_window)):
        r1 = rms_per_window[i - 1]
        r2 = rms_per_window[i]
        if r1 > 200 and r2 > 200:
            ratio = max(r1, r2) / min(r1, r2)
            if ratio > 5.0 and abs(r1 - r2) > 3000:
                vol_jumps += 1

    return {
        "file": str(wav_path),
        "status": "analyzed",
        "duration_sec": round(duration_sec, 2),
        "sample_rate": sr,
        "unnatural_gaps_count": len(unnatural_gaps),
        "worst_gap_ms": round(worst_gap_ms, 1),
        "boundary_clicks_count": boundary_clicks_count,
        "underruns_count": underruns_count,
        "volume_jumps_count": vol_jumps,
    }


def main():
    parser = argparse.ArgumentParser(description="Audio Continuity Diagnostic Tool")
    parser.add_argument("--input", help="Single WAV file to check")
    parser.add_argument("--dir", help="Directory of WAV files to analyze")
    parser.add_argument("--report", default="recordings/continuity_report.json", help="Path to save output JSON")
    parser.add_argument("--gap-threshold-ms", type=float, default=250.0, help="Unnatural gap threshold in ms")
    args = parser.parse_args()

    files_to_check = []
    if args.input:
        files_to_check.append(Path(args.input))
    elif args.dir:
        d = Path(args.dir)
        files_to_check.extend(list(d.glob("*.wav")))
        files_to_check.extend(list(d.glob("**/*.wav")))
    else:
        # Default scan across session runs and recordings
        files_to_check.extend(list(Path("session_runs").glob("**/*.wav")))
        files_to_check.extend(list(Path("recordings").glob("*.wav")))

    # Deduplicate
    unique_files = sorted(list({p.resolve() for p in files_to_check if p.is_file()}))

    print("\n" + "=" * 75)
    print("           AUDIO CONTINUITY & SEAMLESS STREAMING DIAGNOSTIC             ")
    print("=" * 75)
    print(f"Total WAV files to analyze: {len(unique_files)}")
    print(f"Unnatural Clause Gap Threshold: > {args.gap_threshold_ms} ms")
    print("-" * 75)

    results = []
    total_gaps = 0
    total_clicks = 0
    total_underruns = 0
    worst_gap_overall = 0.0

    for p in unique_files:
        res = analyze_wav_continuity(p, silence_threshold_ms=args.gap_threshold_ms)
        results.append(res)
        total_gaps += res["unnatural_gaps_count"]
        total_clicks += res["boundary_clicks_count"]
        total_underruns += res["underruns_count"]
        if res["worst_gap_ms"] > worst_gap_overall:
            worst_gap_overall = res["worst_gap_ms"]

        if res["unnatural_gaps_count"] > 0 or res["boundary_clicks_count"] > 0:
            print(f"  [!] {p.name:<32} | Gaps: {res['unnatural_gaps_count']:<2} | Worst Gap: {res['worst_gap_ms']:<6.1f}ms | Clicks: {res['boundary_clicks_count']:<3} | Underruns: {res['underruns_count']}")
        else:
            print(f"  [OK] {p.name:<31} | Duration: {res['duration_sec']:<5.1f}s | Gaps: 0 | Clicks: 0 | Clean stream")

    # Save report
    rep_path = Path(args.report)
    rep_path.parent.mkdir(parents=True, exist_ok=True)
    rep_path.write_text(json.dumps(results, indent=2), encoding="utf-8")

    print("\n" + "=" * 75)
    print("SUMMARY DIAGNOSTIC:")
    print(f"  Total Files Analyzed       : {len(results)}")
    print(f"  Total Unnatural Gaps (>250ms): {total_gaps}")
    print(f"  Worst Unnatural Gap Recorded : {worst_gap_overall:.1f} ms")
    print(f"  Total Boundary Clicks        : {total_clicks}")
    print(f"  Total Playback Underruns     : {total_underruns}")
    print(f"  Report saved to              : {rep_path.resolve()}")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    main()
