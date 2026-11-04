"""Day 4 Real-Call Test Campaign Runner (35 Structured Scenarios).

Runs an interactive real-call test battery across:
- Languages: Hindi, English, Marathi, Hinglish
- Voice/Acoustic profiles: Noisy cafe, fast speaker, slow speaker, elderly voice, regional accents
- Turn behaviors: Rapid interruptions, 30s long monologues, 20s silences, mid-sentence hangup
- Business flows: Booking, double-booking, relative dates (kal, parso, उद्या), out-of-scope queries
- Escalations & Telephony: Human transfer, voicemail detection, wrong number, angry caller
- Concurrency: 2 simultaneous calls, 3 simultaneous calls, 4th call rejection (HTTP 429)

Saves all evaluations to reports/campaign_<YYYYMMDD_HHMMSS>.csv.

Usage:
  python scripts/test_campaign.py
  python scripts/test_campaign.py --list
  python scripts/test_campaign.py --scenario C-01
"""

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
import sys
from typing import Any, Dict, List

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


CAMPAIGN_SCENARIOS = [
    # ----------------------------------------------------
    # 1. HINDI FLOWS (C-01 to C-05)
    # ----------------------------------------------------
    {
        "id": "C-01",
        "category": "Hindi Core",
        "name": "दांत में दर्द और कल का अपॉइंटमेंट",
        "script": "नमस्ते, मेरे दाढ़ में बहुत तेज दर्द है। क्या कल दोपहर 2:00 बजे डॉक्टर शर्मा का अपॉइंटमेंट मिल सकता है? मेरा नाम राहुल वर्मा है।",
        "expected": "Bot books slot for tomorrow 2:00 PM in Hindi and reads back confirmation with Rahul Verma.",
        "needs_second_person": False,
    },
    {
        "id": "C-02",
        "category": "Hindi Core",
        "name": "क्लिनिक का समय और रविवार की टाइमिंग",
        "script": "क्लिनिक शाम को कितने बजे तक खुला रहता है और क्या रविवार को डॉक्टर बैठते हैं?",
        "expected": "Bot answers 9 AM - 8 PM Mon-Sat, Sunday 10 AM - 2 PM, strictly adhering to clinic info.",
        "needs_second_person": False,
    },
    {
        "id": "C-03",
        "category": "Hindi Core",
        "name": "रूट कैनाल की फीस और एक्सरे चार्जेस",
        "script": "रूट कैनाल ट्रीटमेंट की टोटल फीस कितनी होगी और क्या एक्सरे का अलग से पैसा लगेगा?",
        "expected": "Quotes ₹3,500 - ₹6,000 for RCT and consultation ₹500.",
        "needs_second_person": False,
    },
    {
        "id": "C-04",
        "category": "Hindi Core",
        "name": "परसों सुबह की अपॉइंटमेंट (Relative Date: Parso)",
        "script": "मुझे परसों सुबह 10:30 बजे दांतों की सफाई के लिए आना है। क्या स्लॉट खाली है?",
        "expected": "Normalizes 'parso' to IST (Today + 2 days) and checks 10:30 AM slot.",
        "needs_second_person": False,
    },
    {
        "id": "C-05",
        "category": "Hindi Core",
        "name": "क्लिनिक का पता और निकटतम मेट्रो स्टेशन",
        "script": "आपका क्लिनिक किस जगह पर है और सबसे पास वाला मेट्रो या बस स्टॉप कौन सा है?",
        "expected": "Provides clinic address (Shop 4, Aarogya Heights) and landmark.",
        "needs_second_person": False,
    },

    # ----------------------------------------------------
    # 2. ENGLISH FLOWS (C-06 to C-10)
    # ----------------------------------------------------
    {
        "id": "C-06",
        "category": "English Core",
        "name": "Teeth Cleaning & Polishing Booking",
        "script": "Hi Priya, I want to book a teeth cleaning session for tomorrow at 4:00 PM. My name is Ananya Roy.",
        "expected": "Books cleaning appointment at 4:00 PM tomorrow with confirmation readback.",
        "needs_second_person": False,
    },
    {
        "id": "C-07",
        "category": "English Core",
        "name": "Doctor Credentials & Experience Query",
        "script": "Could you tell me about Dr. Sharma's qualifications and how many years of experience he has?",
        "expected": "Answers BDS, MDS Endodontist with 12+ years experience.",
        "needs_second_person": False,
    },
    {
        "id": "C-08",
        "category": "English Core",
        "name": "Insurance & Card Payment Methods",
        "script": "Do you accept HDFC health insurance cashless claims and credit cards at the clinic?",
        "expected": "Answers accepted payment modes and insurance policy per clinic docs.",
        "needs_second_person": False,
    },
    {
        "id": "C-09",
        "category": "English Core",
        "name": "Walk-in Severe Emergency Query",
        "script": "I suffered a dental trauma in an accident and my tooth is chipped. Can I walk in right now?",
        "expected": "Offers immediate emergency guidance and walk-in protocol.",
        "needs_second_person": False,
    },
    {
        "id": "C-10",
        "category": "English Core",
        "name": "Human Receptionist Escalation",
        "script": "I have an intricate query regarding my previous root canal warranty. Please connect me to the human receptionist.",
        "expected": "Triggers transfer_call to clinic human operator.",
        "needs_second_person": False,
    },

    # ----------------------------------------------------
    # 3. MARATHI FLOWS (C-11 to C-15)
    # ----------------------------------------------------
    {
        "id": "C-11",
        "category": "Marathi Core",
        "name": "दातदुखी आणि उद्याची भेट (Relative Date: Udya)",
        "script": "नमस्कार, माझ्या दाढेत भयंकर ठसठस होत आहे. उद्या संध्याकाळी 5:00 वाजता डॉक्टरांची वेळ मिळेल का? माझं नाव आनंद पाटील आहे.",
        "expected": "Understands Marathi, normalizes 'udya' to tomorrow 5:00 PM, books appointment with readback.",
        "needs_second_person": False,
    },
    {
        "id": "C-12",
        "category": "Marathi Core",
        "name": "दवाखान्याची वेळ आणि सुट्टी",
        "script": "दवाखाना सकाळी किती वाजता उघडतो आणि रविवारी चालू असतो का?",
        "expected": "Responds in pure, polite Marathi regarding clinic timings.",
        "needs_second_person": False,
    },
    {
        "id": "C-13",
        "category": "Marathi Core",
        "name": "तपासणी फी आणि खर्चाची चौकशी",
        "script": "डॉक्टरांची पहिली तपासणी फी किती आहे आणि दातांच्या कवळीचा खर्च किती येतो?",
        "expected": "Provides Marathi consultation fee (₹500) and denture guidance.",
        "needs_second_person": False,
    },
    {
        "id": "C-14",
        "category": "Marathi Core",
        "name": "सोमवारची अपॉइंटमेंट (Day Name: Somwar)",
        "script": "मला सोमवारी सकाळी 11:30 वाजता डॉक्टरांना भेटायचे आहे, वेळ रिकामी आहे का?",
        "expected": "Correctly parses 'somwar' (Monday) in Marathi and queries availability.",
        "needs_second_person": False,
    },
    {
        "id": "C-15",
        "category": "Marathi Core",
        "name": "मानवी कर्मचाऱ्याशी बोलण्याची विनंती",
        "script": "मला प्रत्यक्ष क्लिनिकमधील माणसाशी बोलायचं आहे, कृपया फोन जोडून द्या.",
        "expected": "Invokes transfer_call tool in Marathi politely.",
        "needs_second_person": False,
    },

    # ----------------------------------------------------
    # 4. HINGLISH FLOWS (C-16 to C-18)
    # ----------------------------------------------------
    {
        "id": "C-16",
        "category": "Hinglish Core",
        "name": "Hinglish Booking with Slot Check",
        "script": "Hey Priya, mujhe kal afternoon mein doctor consultation book karna hai, 3:30 PM ka slot available hai kya?",
        "expected": "Natural Hinglish code-switching response confirming 3:30 PM slot.",
        "needs_second_person": False,
    },
    {
        "id": "C-17",
        "category": "Hinglish Core",
        "name": "Teeth Whitening Procedure & Cost",
        "script": "Dr. Sharma laser teeth whitening bhi karte hain kya, and kitna time lagta hai ek session mein?",
        "expected": "Explains procedure duration (~45 mins) and cost in Hinglish.",
        "needs_second_person": False,
    },
    {
        "id": "C-18",
        "category": "Hinglish Core",
        "name": "Reschedule & Confirmation Request",
        "script": "Mera purana appointment reschedule karna hai to next Tuesday 12 PM, confirmation message bhej do.",
        "expected": "Handles reschedule logic and mentions confirmation SMS/callback.",
        "needs_second_person": False,
    },

    # ----------------------------------------------------
    # 5. ACOUSTIC & SPEAKER DIVERSITY (C-19 to C-23)
    # ----------------------------------------------------
    {
        "id": "C-19",
        "category": "Acoustic Variations",
        "name": "Noisy Background (Traffic / Cafe / Street Noise)",
        "script": "[Simulate street traffic or background television noise while speaking] नमस्ते, मुझे कल की टाइमिंग जाननी है।",
        "expected": "VAD correctly ignores background hum and extracts user utterance without hallucination.",
        "needs_second_person": False,
    },
    {
        "id": "C-20",
        "category": "Acoustic Variations",
        "name": "Fast Speaker (Rapid Continuous Speech)",
        "script": "[Speak rapidly without pauses] Hello Priya mujhe root canal karwana hai kal morning slot chahiye fees kitni hogi jaldi bataiye.",
        "expected": "STT correctly transcribes fast speech; LLM answers root canal cost and timing.",
        "needs_second_person": False,
    },
    {
        "id": "C-21",
        "category": "Acoustic Variations",
        "name": "Slow Speaker with Mid-Sentence Thinking Pauses",
        "script": "नमस्ते प्रिया... (pause 2.5s) ...मुझे डॉक्टर से मिलना था... (pause 2.5s) ...क्या कल शाम का स्लॉट मिल सकता है?",
        "expected": "Conjunction / smart pause prevents bot from interrupting during the 2.5s thinking pause.",
        "needs_second_person": False,
    },
    {
        "id": "C-22",
        "category": "Acoustic Variations",
        "name": "Elderly / Low-Pitch Voice Simulation",
        "script": "[Speak in low pitch, soft voice] बेटा, मुझे अपने दांतों का चेकअप कराना है, डॉक्टर साहब कब मिलेंगे?",
        "expected": "VAD triggers on softer voice; bot responds politely with clinic timings.",
        "needs_second_person": False,
    },
    {
        "id": "C-23",
        "category": "Acoustic Variations",
        "name": "Strong Regional Accent (Bhojpuri / Marathi Accent)",
        "script": "प्रिया जी, हमार दाँत में बहुत दर्द बा, का डाक्टर साहेब आज बइठबें?",
        "expected": "Multilingual STT (Nova-3/Sarvam) captures intent; agent replies in clear Hindi.",
        "needs_second_person": False,
    },

    # ----------------------------------------------------
    # 6. EDGE CASES & TURNING (C-24 to C-29)
    # ----------------------------------------------------
    {
        "id": "C-24",
        "category": "Edge Cases",
        "name": "Instant Mid-Sentence Barge-In (3x Interruptions)",
        "script": "[Wait for agent to start speaking, then immediately cut in with:] 'रुको रुको! मुझे पहले फीस जाननी है!'",
        "expected": "Agent voice halts instantly upon user barge-in; switches immediately to answering fees.",
        "needs_second_person": False,
    },
    {
        "id": "C-25",
        "category": "Edge Cases",
        "name": "Long Monologue (30-second Dental History)",
        "script": (
            "डॉक्टर साहब को बताना कि तीन साल पहले मैंने राइट साइड के दाढ़ में फिलिंग करवाई थी। "
            "अभी चार दिन से वहां तेज दर्द हो रहा है, ठंडे पानी से झनझनाहट होती है और सिर में भी दर्द रहता है। "
            "मैंने पेनकिलर खाया पर आराम नहीं मिला। क्या दोबारा रूट कैनाल कराना पड़ेगा या कैप बदलनी होगी?"
        ),
        "expected": "Buffers full 30s speech; LLM summarizes symptoms and recommends consultation.",
        "needs_second_person": False,
    },
    {
        "id": "C-26",
        "category": "Edge Cases",
        "name": "20-Second Silence & Watchdog Recovery",
        "script": "[Stay completely silent for 20 seconds after greeting]",
        "expected": "Level 1 silence prompt at ~8s ('क्या आप वहां हैं?'), followed by polite farewell and hangup at ~16s.",
        "needs_second_person": False,
    },
    {
        "id": "C-27",
        "category": "Edge Cases",
        "name": "Wrong Number Inquiry",
        "script": "नमस्ते, क्या यह शर्मा ऑटोमोबाइल गैराज है? मेरी कार की सर्विसिंग करानी थी।",
        "expected": "Politely clarifies that this is Aarogya Dental Care and not a garage.",
        "needs_second_person": False,
    },
    {
        "id": "C-28",
        "category": "Edge Cases",
        "name": "Angry / Frustrated Caller Escalation",
        "script": "तुम लोग बिल्कुल फ्रॉड हो! मुझे किसी बॉट से बात नहीं करनी, तुरंत किसी सीनियर डॉक्टर से बात कराओ!",
        "expected": "De-escalates calmly and automatically triggers transfer_call to human operator.",
        "needs_second_person": False,
    },
    {
        "id": "C-29",
        "category": "Edge Cases",
        "name": "Mid-Sentence Caller Hangup",
        "script": "[Speak half a sentence and immediately disconnect the phone call:] 'नमस्ते, मुझे डॉक्टर से... [HANGUP]'",
        "expected": "Pipeline terminates cleanly, marks call status as completed/hangup, no ghost processes.",
        "needs_second_person": False,
    },

    # ----------------------------------------------------
    # 7. BUSINESS LOGIC & CONFLICTS (C-30 to C-32)
    # ----------------------------------------------------
    {
        "id": "C-30",
        "category": "Business Logic",
        "name": "Double Booking Conflict Detection",
        "script": "मुझे कल दोपहर 2:00 बजे डॉक्टर शर्मा से मिलना है। (Try to book the EXACT same slot booked in C-01)",
        "expected": "Slot conflict detected in SQLite. Bot informs slot is already booked and offers alternative times.",
        "needs_second_person": False,
    },
    {
        "id": "C-31",
        "category": "Business Logic",
        "name": "Out-of-Scope Medical Query (Hallucination Test)",
        "script": "क्या आपके क्लिनिक में आँखों का मोतियाबिंद का ऑपरेशन या घुटने का इलाज होता है?",
        "expected": "Refuses out-of-scope procedure; clarifies clinic exclusively provides dental treatments.",
        "needs_second_person": False,
    },
    {
        "id": "C-32",
        "category": "Business Logic",
        "name": "Voicemail / Answering Machine Audio Simulation",
        "script": "[Play voicemail prompt:] 'Please leave your message after the tone. Record your message now.'",
        "expected": "AMD triggers; bot follows configured policy (hangs up or speaks one short callback note).",
        "needs_second_person": False,
    },

    # ----------------------------------------------------
    # 8. CONCURRENCY TESTS (C-33 to C-35)
    # ----------------------------------------------------
    {
        "id": "C-33",
        "category": "Concurrency",
        "name": "Two Simultaneous Calls (Load Test)",
        "script": "Place two phone calls at the exact same moment from two different phones.",
        "expected": "Both calls connect simultaneously, stream audio cleanly without cross-talk or lag.",
        "needs_second_person": True,
    },
    {
        "id": "C-34",
        "category": "Concurrency",
        "name": "Three Simultaneous Calls (Max Configured Concurrency)",
        "script": "Place three phone calls simultaneously from 3 numbers (reaches MAX_CONCURRENT_CALLS=3 limit).",
        "expected": "All 3 calls active simultaneously. Concurrency counter shows 3/3 acquired slots.",
        "needs_second_person": True,
    },
    {
        "id": "C-35",
        "category": "Concurrency",
        "name": "Fourth Simultaneous Call (Overflow Rejection)",
        "script": "Attempt to place a 4th call via POST /calls while 3 calls are actively connected.",
        "expected": "Server rejects 4th call with HTTP 429 Too Many Requests ('Concurrency limit reached').",
        "needs_second_person": True,
    },
]


def print_scenario(sc: Dict[str, Any], index: int, total: int) -> None:
    print("\n" + "=" * 75)
    print(f"  SCENARIO [{index}/{total}]: {sc['id']} - {sc['category']}")
    print(f"  Name: {sc['name']}")
    if sc.get("needs_second_person"):
        print("  ⚠️  NOTE: This scenario requires a second caller / simultaneous device!")
    print("=" * 75)
    print(f"  TEST SCRIPT TO SPEAK :\n  \"{sc['script']}\"")
    print("-" * 75)
    print(f"  EXPECTED BEHAVIOR    : {sc['expected']}")
    print("=" * 75)


def collect_result(sc: Dict[str, Any]) -> Dict[str, Any]:
    call_id = input("\nEnter Call ID (or press Enter if testing via local mic): ").strip() or "local_mic"
    
    status_in = input("Result (P for PASS / F for FAIL) [P]: ").strip().upper()
    status = "FAIL" if status_in == "F" else "PASS"

    nat_in = input("Voice Naturalness Score (1-5, where 5 is human-like) [4]: ").strip()
    try:
        naturalness = int(nat_in) if nat_in else 4
    except ValueError:
        naturalness = 4

    und_in = input("Understanding Score (1-5, where 5 is perfect comprehension) [4]: ").strip()
    try:
        understanding = int(und_in) if und_in else 4
    except ValueError:
        understanding = 4

    notes = input("Observations / Bugs / Latency notes: ").strip()

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scenario_id": sc["id"],
        "category": sc["category"],
        "name": sc["name"],
        "call_id": call_id,
        "status": status,
        "naturalness_score": naturalness,
        "understanding_score": understanding,
        "notes": notes,
    }


def main():
    parser = argparse.ArgumentParser(description="Day 4 Real-Call Test Campaign Runner")
    parser.add_argument("--list", action="store_true", help="List all 35 campaign scenarios and exit")
    parser.add_argument("--scenario", help="Run a specific scenario by ID (e.g. C-01)")
    parser.add_argument("--output", help="Custom output CSV path (default: reports/campaign_<timestamp>.csv)")
    args = parser.parse_args()

    if args.list:
        print("\n" + "=" * 70)
        print("           DAY 4 REAL-CALL TEST CAMPAIGN: 35 SCENARIOS           ")
        print("=" * 70)
        for s in CAMPAIGN_SCENARIOS:
            flag = " [NEEDS 2ND PERSON]" if s.get("needs_second_person") else ""
            print(f"{s['id']:<6} | {s['category']:<22} | {s['name']}{flag}")
        print("=" * 70 + "\n")
        return

    selected = CAMPAIGN_SCENARIOS
    if args.scenario:
        selected = [s for s in CAMPAIGN_SCENARIOS if s["id"].upper() == args.scenario.upper()]
        if not selected:
            print(f"[!] Scenario ID '{args.scenario}' not found.")
            sys.exit(1)

    reports_dir = Path("reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    csv_path = Path(args.output) if args.output else reports_dir / f"campaign_{timestamp}.csv"

    print("\n" + "=" * 75)
    print("        STARTING REAL-CALL TEST CAMPAIGN (35 SCENARIOS)        ")
    print(f"  Output CSV: {csv_path}")
    print("=" * 75)

    fieldnames = [
        "timestamp",
        "scenario_id",
        "category",
        "name",
        "call_id",
        "status",
        "naturalness_score",
        "understanding_score",
        "notes",
    ]

    results = []
    total = len(selected)

    try:
        for idx, sc in enumerate(selected, 1):
            print_scenario(sc, idx, total)
            res = collect_result(sc)
            results.append(res)
            print(f"[*] Recorded [{res['status']}] for {sc['id']}.")

            # Save progress incrementally after each scenario
            with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(results)

    except KeyboardInterrupt:
        print("\n[!] Campaign paused by user.")

    passed_count = sum(1 for r in results if r["status"] == "PASS")
    print("\n" + "=" * 75)
    print(f"  CAMPAIGN COMPLETE: {passed_count}/{len(results)} PASSED")
    print(f"  Report saved to: {csv_path}")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    main()
