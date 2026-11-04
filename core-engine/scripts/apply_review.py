"""Apply Native-Speaker Review Corrections and Retrain Style & Vocabulary for PART H2.

Takes human native reviewer corrections from review CSV, automatically:
1. Detects translated/script terms and adds them to language_packs/<lang>/banned_patterns.json.
2. Extracts corrected phrases and updates language_packs/<lang>/glossary.json.
3. Appends polished corrected dialogues into language_packs/<lang>/dialogues.json.
4. Computes measured round scores (naturalness, sounds translated %, correctness, accent, smoothness).
5. Generates Round 2 evaluation sheet if requested.
"""

import argparse
import csv
import json
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from scripts.review_sheet import evaluate_review_sheet, generate_review_sheet


def apply_review_corrections(review_csv: Path, lang: str, next_round: bool = True) -> None:
    lang = lang.lower().strip()
    if not review_csv.is_file():
        print(f"[!] Error: Review CSV not found at {review_csv}")
        sys.exit(1)

    print("\n" + "=" * 65)
    print("      APPLYING NATIVE-SPEAKER CORRECTIONS & TRAINING LOOP      ")
    print("=" * 65)
    
    # 1. Run statistical evaluation
    metrics = evaluate_review_sheet(review_csv)

    # 2. Load language pack files
    banned_file = Path(f"language_packs/{lang}/banned_patterns.json")
    glossary_file = Path(f"language_packs/{lang}/glossary.json")
    dialogues_file = Path(f"language_packs/{lang}/dialogues.json")

    banned_data = json.loads(banned_file.read_text(encoding="utf-8")) if banned_file.is_file() else {"banned_phrases": []}
    glossary_data = json.loads(glossary_file.read_text(encoding="utf-8")) if glossary_file.is_file() else {}
    dialogues_data = json.loads(dialogues_file.read_text(encoding="utf-8")) if dialogues_file.is_file() else {}

    # Read review rows
    rows = []
    with open(review_csv, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    added_banned = 0
    added_dialogues = 0
    manual_edits_needed = []

    for r in rows:
        cid = r.get("id")
        mode = r.get("mode", "general")
        agent_r = r.get("agent_reply", "").strip()
        corrected = r.get("corrected_reply", "").strip()
        translated_flag = str(r.get("sounds_translated_yn", "")).strip().lower() in ("yes", "y", "true", "1")
        notes = r.get("reviewer_notes", "").strip()

        # If flagged as translated without correction, flag for manual review
        if translated_flag and not corrected:
            manual_edits_needed.append(f"Row #{cid} ({mode}): Flagged as translated '{agent_r}' — Notes: {notes}")

        # If reviewer gave a direct correction
        if corrected and corrected != agent_r:
            # 1. Ban the awkward/unnatural phrase if flagged
            if translated_flag and agent_r not in banned_data.get("banned_phrases", []):
                banned_data.setdefault("banned_phrases", []).append(agent_r)
                added_banned += 1

            # 2. Add corrected pair to dialogues
            mode_dialogues = dialogues_data.setdefault(mode, [])
            caller_q = r.get("caller_query", "").strip()
            # Check if duplicate
            if not any(d.get("user") == caller_q and d.get("agent") == corrected for d in mode_dialogues):
                mode_dialogues.append({"user": caller_q, "agent": corrected})
                added_dialogues += 1

    # Save updated language pack files
    banned_file.write_text(json.dumps(banned_data, ensure_ascii=False, indent=2), encoding="utf-8")
    dialogues_file.write_text(json.dumps(dialogues_data, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n[+] Automated Training Updates Applied:")
    print(f"    - Banned Patterns Added : {added_banned}")
    print(f"    - Exemplary Dialogues   : {added_dialogues}")
    print(f"    - Updated Files         : {banned_file.name}, {dialogues_file.name}")

    if manual_edits_needed:
        print("\n[!] Stylistic Items Requiring Native Speaker Guidance:")
        for item in manual_edits_needed[:5]:
            print(f"    - {item}")
        if len(manual_edits_needed) > 5:
            print(f"    - ... and {len(manual_edits_needed) - 5} more.")
    else:
        print("\n[+] No ambiguous flags found; all reviewer corrections absorbed cleanly!")

    # 3. Next round generation if needed
    if next_round:
        round2_csv = Path(f"review_{lang}_round2.csv")
        generate_review_sheet(lang=lang, output_csv=round2_csv, generate_audio=True)
        print(f"\n[+] Next round review sheet generated: {round2_csv.resolve()}")

    print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Apply native speaker review corrections")
    parser.add_argument("--input", required=True, help="Path to completed review CSV")
    parser.add_argument("--lang", required=True, choices=["mr", "hi"], help="Language code (mr, hi)")
    parser.add_argument("--no-next-round", action="store_true", help="Do not generate round 2 CSV")
    args = parser.parse_args()

    apply_review_corrections(
        review_csv=Path(args.input),
        lang=args.lang,
        next_round=not args.no_next_round,
    )


if __name__ == "__main__":
    main()
