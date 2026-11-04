"""Per-call and aggregated cost estimation script for voice calling agent.

Assumptions (configurable via .env or CLI):
- Deepgram Nova-3: $0.0043 / min
- Sarvam STT: $0.0035 / min
- Groq Llama 3.3 70B: $0.59 / 1M prompt tokens, $0.79 / 1M completion tokens
- Cartesia Sonic TTS: $0.015 / 1k characters
- Sarvam Bulbul TTS: $0.010 / 1k characters
- Twilio Outbound PSTN (India): $0.0140 / min
- Exotel Outbound PSTN (India): $0.0125 / min

Usage:
  python scripts/estimate_cost.py [--duration-sec 120] [--turns 6]
  python scripts/estimate_cost.py --file metrics/call_123.json
"""

import argparse
import json
from pathlib import Path
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import get_settings

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def estimate_call_cost(
    duration_sec: float,
    turns: int = 4,
    stt_provider: str = "deepgram",
    tts_provider: str = "cartesia",
    telephony_provider: str = "twilio",
    user_words_per_turn: int = 15,
    agent_words_per_turn: int = 25,
) -> None:
    settings = get_settings()

    minutes = max(duration_sec / 60.0, 0.05)
    stt_minutes = (turns * user_words_per_turn / 2.5) / 60.0  # ~150 words per min speech

    # Token calculations
    prompt_tokens_per_turn = 450 + (turns * 35)  # prompt context + history
    total_prompt_tokens = prompt_tokens_per_turn * turns
    total_completion_tokens = int(turns * agent_words_per_turn * 1.35)
    tts_characters = turns * agent_words_per_turn * 6

    # Unit rates (USD)
    stt_rate = 0.0043 if stt_provider == "deepgram" else 0.0035
    llm_prompt_rate = settings.rate_llm_input_1k / 1000.0
    llm_completion_rate = settings.rate_llm_output_1k / 1000.0
    tts_rate = 0.015 / 1000.0 if tts_provider == "cartesia" else 0.010 / 1000.0
    telephony_rate = 0.0140 if telephony_provider == "twilio" else 0.0125

    cost_stt = stt_minutes * stt_rate
    cost_llm = (total_prompt_tokens * llm_prompt_rate) + (total_completion_tokens * llm_completion_rate)
    cost_tts = tts_characters * tts_rate
    cost_telephony = minutes * telephony_rate
    total_cost = cost_stt + cost_llm + cost_tts + cost_telephony

    print("\n" + "=" * 65)
    print("             CALL COST ESTIMATION & UNIT ECONOMICS              ")
    print("=" * 65)
    print(f"Call Duration       : {duration_sec:.1f}s ({minutes:.2f} mins)")
    print(f"Dialogue Turns      : {turns}")
    print(f"Telephony Provider  : {telephony_provider.upper()} (${telephony_rate:.4f}/min)")
    print(f"STT Provider        : {stt_provider.upper()} (${stt_rate:.4f}/min)")
    print(f"TTS Provider        : {tts_provider.upper()} (${tts_rate*1000:.3f}/1k chars)")
    print("-" * 65)
    print(f"STT Audio Cost      : ${cost_stt:.5f}")
    print(f"LLM Token Cost      : ${cost_llm:.5f} ({total_prompt_tokens} in / {total_completion_tokens} out)")
    print(f"TTS Synthesis Cost  : ${cost_tts:.5f} ({tts_characters} chars)")
    print(f"Carrier Telephony   : ${cost_telephony:.5f}")
    print("-" * 65)
    print(f"TOTAL CALL COST     : ${total_cost:.4f} USD (~₹{total_cost*87.0:.2f} INR)")
    print(f"COST PER MINUTE     : ${total_cost/minutes:.4f} USD/min (~₹{(total_cost/minutes)*87.0:.2f} INR/min)")
    print("=" * 65)
    print("* ASSUMPTIONS: Standard vendor list prices as of Q4 2026. Taxes & carrier dips excluded.\n")


def main():
    parser = argparse.ArgumentParser(description="Estimate Voice Call Unit Cost")
    parser.add_argument("--duration-sec", type=float, default=90.0, help="Total call duration in seconds")
    parser.add_argument("--turns", type=int, default=5, help="Number of spoken turns")
    parser.add_argument("--stt", default="deepgram", choices=["deepgram", "sarvam"])
    parser.add_argument("--tts", default="cartesia", choices=["cartesia", "sarvam"])
    parser.add_argument("--telephony", default="twilio", choices=["twilio", "exotel"])
    parser.add_argument("--file", help="Calculate from metrics JSON file")
    args = parser.parse_args()

    if args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                d = json.load(f)
            dur = d.get("duration_sec", 60.0)
            turns = len(d.get("turns", [])) or 4
            estimate_call_cost(duration_sec=dur, turns=turns)
            return
        except Exception as e:
            print(f"[!] Could not read file: {e}")

    estimate_call_cost(
        duration_sec=args.duration_sec,
        turns=args.turns,
        stt_provider=args.stt,
        tts_provider=args.tts,
        telephony_provider=args.telephony,
    )


if __name__ == "__main__":
    main()
