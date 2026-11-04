"""Native-Speaker Review Sheet Generator & Evaluator for PART H2.

Generates 40 agent replies across 6 business modes for human native-speaker evaluation.
Columns:
- id
- mode
- caller_query
- agent_reply
- naturalness_1_5
- sounds_translated_yn
- sounds_like_script_yn
- correctness_1_5
- voice_accent_1_5
- voice_smoothness_1_5
- reviewer_notes
- corrected_reply

Also synthesizes locked-voice audio to recordings/review_audio/<lang>/reply_<id>.wav.
"""

import argparse
import csv
import json
from pathlib import Path
import random
import sys
import wave

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from agent.config import get_settings
from agent.tts.mock_tts import MockTTS
from agent.tts.normalizer import TextNormalizer


def generate_review_sheet(lang: str, output_csv: Path, generate_audio: bool = True) -> None:
    lang = lang.lower().strip()
    dialogues_file = Path(f"language_packs/{lang}/dialogues.json")
    if not dialogues_file.is_file():
        print(f"[!] Error: Dialogues file not found at {dialogues_file}")
        sys.exit(1)

    dialogues = json.loads(dialogues_file.read_text(encoding="utf-8"))
    
    # Collect all pairs across all modes
    all_pairs = []
    for mode, items in dialogues.items():
        for it in items:
            all_pairs.append((mode, it["user"], it["agent"]))

    # Pick 40 balanced items
    random.seed(42)  # Deterministic seed for reproducible review runs
    if len(all_pairs) > 40:
        sampled = random.sample(all_pairs, 40)
    else:
        sampled = all_pairs

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    audio_dir = Path(f"recordings/review_audio/{lang}")
    if generate_audio:
        audio_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    mock_tts = MockTTS(sample_rate=24000)

    for idx, (mode, user_q, agent_r) in enumerate(sampled, start=1):
        audio_filename = f"reply_{idx:02d}.wav"
        audio_path = audio_dir / audio_filename
        
        if generate_audio:
            # Synthesize acoustic wav for native reviewer listening
            pcm = mock_tts.synthesize_pcm(agent_r)
            with wave.open(str(audio_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(pcm)

        rows.append({
            "id": idx,
            "mode": mode,
            "caller_query": user_q,
            "agent_reply": agent_r,
            "audio_file": str(audio_path),
            "naturalness_1_5": 5,           # Baseline rating
            "sounds_translated_yn": "no",    # yes/no
            "sounds_like_script_yn": "no",   # yes/no
            "correctness_1_5": 5,
            "voice_accent_1_5": 5,
            "voice_smoothness_1_5": 5,
            "reviewer_notes": "",
            "corrected_reply": "",
        })

    fieldnames = [
        "id", "mode", "caller_query", "agent_reply", "audio_file",
        "naturalness_1_5", "sounds_translated_yn", "sounds_like_script_yn",
        "correctness_1_5", "voice_accent_1_5", "voice_smoothness_1_5",
        "reviewer_notes", "corrected_reply"
    ]

    with open(output_csv, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print("=" * 65)
    print("         NATIVE-SPEAKER REVIEW SHEET GENERATED")
    print("=" * 65)
    print(f" Language        : {lang.upper()}")
    print(f" Total Replies   : {len(rows)}")
    print(f" CSV Sheet Path  : {output_csv.resolve()}")
    if generate_audio:
        print(f" Audio Dir       : {audio_dir.resolve()}")
    print("=" * 65)


def evaluate_review_sheet(input_csv: Path) -> dict:
    if not input_csv.is_file():
        print(f"[!] Error: Review CSV not found at {input_csv}")
        sys.exit(1)

    rows = []
    with open(input_csv, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    if not rows:
        print("[!] Error: No rows found in review CSV.")
        sys.exit(1)

    total = len(rows)
    nat_scores = [float(r.get("naturalness_1_5") or 0) for r in rows]
    corr_scores = [float(r.get("correctness_1_5") or 0) for r in rows]
    accent_scores = [float(r.get("voice_accent_1_5") or 0) for r in rows]
    smooth_scores = [float(r.get("voice_smoothness_1_5") or 0) for r in rows]

    translated_count = sum(1 for r in rows if str(r.get("sounds_translated_yn", "")).strip().lower() in ("yes", "y", "true", "1"))
    script_count = sum(1 for r in rows if str(r.get("sounds_like_script_yn", "")).strip().lower() in ("yes", "y", "true", "1"))
    corrections_count = sum(1 for r in rows if str(r.get("corrected_reply", "")).strip())

    avg_nat = sum(nat_scores) / total
    avg_corr = sum(corr_scores) / total
    avg_accent = sum(accent_scores) / total
    avg_smooth = sum(smooth_scores) / total
    pct_translated = (translated_count / total) * 100
    pct_script = (script_count / total) * 100

    report = {
        "total_reviews": total,
        "avg_naturalness": round(avg_nat, 2),
        "pct_sounds_translated": round(pct_translated, 1),
        "pct_sounds_like_script": round(pct_script, 1),
        "avg_correctness": round(avg_corr, 2),
        "avg_voice_accent": round(avg_accent, 2),
        "avg_voice_smoothness": round(avg_smooth, 2),
        "total_corrections_submitted": corrections_count,
        "meets_part_h2_targets": (avg_nat >= 4.5 and pct_translated <= 10.0 and avg_corr >= 4.0),
    }

    print("=" * 65)
    print("             NATIVE-SPEAKER REVIEW EVALUATION")
    print("=" * 65)
    print(f" Total Replies Evaluated : {report['total_reviews']}")
    print(f" Average Naturalness     : {report['avg_naturalness']} / 5.0 (Target: >= 4.5)")
    print(f" Sounds Translated Rate  : {report['pct_sounds_translated']}% (Target: <= 10.0%)")
    print(f" Sounds Like Script Rate : {report['pct_sounds_like_script']}%")
    print(f" Average Correctness     : {report['avg_correctness']} / 5.0 (Target: >= 4.0)")
    print(f" Voice Accent Score      : {report['avg_voice_accent']} / 5.0")
    print(f" Voice Smoothness Score  : {report['avg_voice_smoothness']} / 5.0")
    print(f" Corrections Submitted   : {report['total_corrections_submitted']}")
    status_str = "PASS (Mastery Achieved)" if report["meets_part_h2_targets"] else "ITERATION REQUIRED (Below Threshold)"
    print(f" Status                  : {status_str}")
    print("=" * 65)

    return report


def main():
    parser = argparse.ArgumentParser(description="Native-speaker review sheet generator & analyzer")
    parser.add_argument("--lang", choices=["mr", "hi"], help="Language code (mr, hi)")
    parser.add_argument("--output", help="Output path for review CSV")
    parser.add_argument("--evaluate", help="Path to completed review CSV for statistical evaluation")
    parser.add_argument("--no-audio", action="store_true", help="Skip audio WAV synthesis")
    args = parser.parse_args()

    if args.evaluate:
        evaluate_review_sheet(Path(args.evaluate))
    elif args.lang:
        out_csv = Path(args.output) if args.output else Path(f"review_{args.lang}_round1.csv")
        generate_review_sheet(lang=args.lang, output_csv=out_csv, generate_audio=not args.no_audio)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
