"""Voice Scorecard Evaluation Tool for Blind Multi-Provider Audition.

Generates a blank scorecard CSV for blind subjective evaluation (1-5 scale) across:
1. Naturalness
2. Accent Correctness
3. Clarity
4. Smoothness (No Breaks / Continuous Stream)
5. Emotional Fit

Calculates averages, rankings, and checks threshold >= 4.0 in ALL categories.

Usage:
  python scripts/voice_scorecard.py --generate
  python scripts/voice_scorecard.py --evaluate
"""

import argparse
import csv
import json
from pathlib import Path
import sys

SCORECARD_PATH = Path("voice_audition/voice_scorecard.csv")
KEY_PATH = Path("voice_audition/audition_key.json")
AUDITION_DIR = Path("voice_audition")


def generate_blank_scorecard() -> None:
    """Generate empty scorecard populated with available blind audition audio files."""
    AUDITION_DIR.mkdir(parents=True, exist_ok=True)
    wav_files = sorted(AUDITION_DIR.glob("audition_*_*.wav"))

    if not wav_files:
        print("[!] No audition WAV files found in voice_audition/. Run scripts/voice_audition.py first.")
        # Create template with dummy rows so user sees format
        candidates = [
            ("mr", "A"), ("mr", "B"), ("mr", "C"),
            ("en", "A"), ("en", "B"), ("en", "C"),
            ("hi", "A"), ("hi", "B"), ("hi", "C"),
        ]
    else:
        candidates = []
        for wf in wav_files:
            parts = wf.stem.split("_")
            if len(parts) >= 3:
                candidates.append((parts[1], parts[2]))

    with open(SCORECARD_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Language",
            "Candidate_Label",
            "Audio_File",
            "Naturalness (1-5)",
            "Accent_Correctness (1-5)",
            "Clarity (1-5)",
            "Smoothness_No_Breaks (1-5)",
            "Emotional_Fit (1-5)",
            "Notes"
        ])
        for lang, label in candidates:
            filename = f"audition_{lang}_{label}.wav"
            writer.writerow([lang, label, filename, "", "", "", "", "", ""])

    print(f"[+] Blank Voice Scorecard generated at: {SCORECARD_PATH.resolve()}")
    print("    Open the CSV, listen to each audio file blind, rate each category 1 to 5, and save.")
    print("    Then run: python scripts/voice_scorecard.py --evaluate\n")


def evaluate_scorecard() -> None:
    """Read filled scorecard CSV, compute metrics, rank, and verify >= 4.0 rule."""
    if not SCORECARD_PATH.is_file():
        print(f"[!] Scorecard file not found at {SCORECARD_PATH}. Run with --generate first.")
        sys.exit(1)

    key_map = {}
    if KEY_PATH.is_file():
        try:
            key_map = json.loads(KEY_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    records = []
    with open(SCORECARD_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lang = row.get("Language", "").strip().lower()
            label = row.get("Candidate_Label", "").strip().upper()
            if not lang or not label:
                continue

            try:
                nat = float(row.get("Naturalness (1-5)") or 0)
                acc = float(row.get("Accent_Correctness (1-5)") or 0)
                cla = float(row.get("Clarity (1-5)") or 0)
                smo = float(row.get("Smoothness_No_Breaks (1-5)") or 0)
                emo = float(row.get("Emotional_Fit (1-5)") or 0)
            except ValueError:
                nat = acc = cla = smo = emo = 0.0

            scores = [nat, acc, cla, smo, emo]
            scored = all(s > 0 for s in scores)
            avg = sum(scores) / len(scores) if scored else 0.0
            passed = scored and all(s >= 4.0 for s in scores)

            records.append({
                "lang": lang,
                "label": label,
                "file": row.get("Audio_File", ""),
                "naturalness": nat,
                "accent": acc,
                "clarity": cla,
                "smoothness": smo,
                "emotion": emo,
                "average": round(avg, 2),
                "passed": passed,
                "notes": row.get("Notes", "").strip()
            })

    if not records:
        print("[!] No candidate rows found in scorecard.")
        return

    print("\n" + "=" * 80)
    print("                    VOICE AUDITION SCORECARD REPORT                    ")
    print("=" * 80)

    for lang in ["mr", "en", "hi"]:
        lang_recs = [r for r in records if r["lang"] == lang]
        if not lang_recs:
            continue

        lang_name = {"mr": "MARATHI", "en": "INDIAN ENGLISH", "hi": "HINDI"}.get(lang, lang.upper())
        print(f"\n--- {lang_name} ({lang.upper()}) CANDIDATES ---")
        lang_recs.sort(key=lambda x: x["average"], reverse=True)

        passed_any = False
        for rank, r in enumerate(lang_recs, 1):
            key_id = f"{lang}_{r['label']}"
            provider_info = key_map.get(key_id, {})
            p_name = provider_info.get("provider", "Blind")
            v_name = provider_info.get("voice_id") or provider_info.get("speaker") or "Unknown"

            status_str = "PASSED (>=4.0 in all categories)" if r["passed"] else "DID NOT PASS"
            print(f"  #{rank} Candidate [{r['label']}] (Audio: {r['file']})")
            print(f"     Provider/Voice: {p_name} - {v_name}")
            print(f"     Naturalness: {r['naturalness']:.1f} | Accent: {r['accent']:.1f} | Clarity: {r['clarity']:.1f} | Smoothness: {r['smoothness']:.1f} | Emotion: {r['emotion']:.1f}")
            print(f"     Average Score: {r['average']:.2f} / 5.00  -->  {status_str}")
            if r["notes"]:
                print(f"     Notes: {r['notes']}")
            if r["passed"]:
                passed_any = True

        if not passed_any:
            print(f"\n  [!] NOTICE: No {lang_name} candidate achieved >= 4.0 across all 5 categories.")
            print("      Actionable Next Steps:")
            print("      1. Audition alternate provider (e.g. switch between Cartesia Sonic 3.6 and Sarvam Bulbul v3).")
            print("      2. Adjust pace (e.g. 0.95x speed) or apply colloquial Devanagari phonetic respelling.")
            print("      3. Record a native speaker consent sample and build a Custom Cloned Voice (see docs/voice_recording_guide.md).")

    print("\n" + "=" * 80)
    print("To save your winning voice, run: python scripts/set_voice.py --lang <mr|en|hi> --pick <A|B|C>")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voice Scorecard Generator and Evaluator")
    parser.add_argument("--generate", action="store_true", help="Generate empty scorecard CSV")
    parser.add_argument("--evaluate", action="store_true", help="Evaluate filled scorecard CSV")
    args = parser.parse_args()

    if args.evaluate:
        evaluate_scorecard()
    else:
        generate_blank_scorecard()
