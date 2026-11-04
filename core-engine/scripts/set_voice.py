"""Voice Selection Tool: Record and commit preferred audition voice per language.

Usage:
  python scripts/set_voice.py --lang mr --pick B
  python scripts/set_voice.py --lang en --pick A
  python scripts/set_voice.py --lang hi --pick A
"""

import argparse
import json
from pathlib import Path
import sys
import yaml

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def set_voice(lang: str, pick: str, config_path: str = "agent_config.yaml") -> None:
    lang = lang.lower().strip()
    pick = pick.upper().strip()

    key_file = Path("voice_audition/audition_key.json")
    if not key_file.is_file():
        print(f"[!] Error: Audition key file not found at {key_file}. Run scripts/voice_audition.py first.")
        sys.exit(1)

    key_data = json.loads(key_file.read_text(encoding="utf-8"))
    cand_id = f"{lang}_{pick}"
    if cand_id not in key_data:
        print(f"[!] Error: Candidate '{pick}' for language '{lang}' not found in audition key.")
        print(f"    Available candidates: {[k for k in key_data.keys() if k.startswith(lang + '_')]}")
        sys.exit(1)

    chosen = key_data[cand_id]
    cfg_file = Path(config_path)
    if not cfg_file.is_file():
        print(f"[!] Error: Config file not found at {cfg_file}.")
        sys.exit(1)

    with open(cfg_file, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f) or {}

    agent_sec = config.setdefault("agent", {})
    voices_sec = agent_sec.setdefault("voices", {})

    lang_map = {"mr": "marathi", "hi": "hindi", "en": "english"}
    target_key = lang_map.get(lang, lang)

    v_id = chosen.get("voice_id") or chosen.get("speaker") or chosen.get("voice_identifier") or "default"
    p_name = chosen.get("provider", "mock").lower()

    lang_entry = {
        "status": "locked",
        "chosen_label": pick,
        "provider": p_name,
        "voice_identifier": v_id,
        "model": chosen.get("model"),
        "settings": {
            "speed": chosen.get("settings", {}).get("speed", 1.0),
            "pace": chosen.get("settings", {}).get("pace", 1.0),
            "pitch": chosen.get("settings", {}).get("pitch", 0.0),
            "sample_rate": chosen.get("settings", {}).get("sample_rate", 24000),
            "pause_ms": 120,
        },
        "locked": True,
    }
    voices_sec[target_key] = lang_entry

    # Clean up redundant legacy / candidate options from voices section
    for legacy_k in ["cartesia", "sarvam", "default_agent_gender"]:
        voices_sec.pop(legacy_k, None)

    with open(cfg_file, "w", encoding="utf-8") as f:
        yaml.dump(config, f, allow_unicode=True, sort_keys=False)

    print("=" * 65)
    print("                VOICE SELECTION CONFIRMED")
    print("=" * 65)
    print(f" Language        : {lang.upper()} ({target_key})")
    print(f" Chosen Pick     : Option [{pick}]")
    print(f" Provider        : {p_name.upper()}")
    print(f" Voice ID/Speaker: {v_id}")
    print(f" Model           : {chosen.get('model')}")
    print(f" Settings        : {chosen.get('settings')}")
    print(f" Config Updated  : {cfg_file.resolve()}")
    print("=" * 65)


def main():
    parser = argparse.ArgumentParser(description="Record preferred voice choice from blind audition")
    parser.add_argument("--lang", required=True, choices=["mr", "hi", "en"], help="Language code (mr, hi, en)")
    parser.add_argument("--pick", required=True, help="Candidate letter pick (A, B, C, D...)")
    parser.add_argument("--config", default="agent_config.yaml", help="Path to agent configuration YAML")
    args = parser.parse_args()

    set_voice(lang=args.lang, pick=args.pick, config_path=args.config)


if __name__ == "__main__":
    main()
