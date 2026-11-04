#!/usr/bin/env python3
"""CLI utility to inspect and triage flagged calls needing human QA review."""

import asyncio
import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from agent.db import DatabaseManager, get_db


def mask_phone_number(phone: str) -> str:
    """Mask phone number leaving only the last 4 digits visible."""
    if not phone:
        return "XXXX"
    s = str(phone).strip()
    if len(s) <= 4:
        return s
    return ("*" * (len(s) - 4)) + s[-4:]


async def print_review_queue(limit: int = 50, json_output: bool = False):
    """Retrieve all calls flagged with needs_review=True, newest first."""
    db = get_db()
    await db.init_db()

    calls = await db.list_calls(needs_review=True, limit=limit)

    if json_output:
        results = []
        for c in calls:
            flags = json.loads(c.flag_reasons) if c.flag_reasons else []
            caller_wav = BASE_DIR / "recordings" / f"{c.id}_caller.wav"
            if not caller_wav.exists():
                caller_wav = BASE_DIR / "recordings" / f"{c.id}.wav"
            agent_wav = BASE_DIR / "recordings" / f"{c.id}_agent.wav"
            transcript_json = BASE_DIR / "transcripts" / f"session_{c.id}.json"
            if not transcript_json.exists():
                transcript_json = BASE_DIR / "transcripts" / f"{c.id}.json"

            results.append({
                "call_id": c.id,
                "caller_number": mask_phone_number(c.caller_number),
                "duration_sec": round(c.duration_sec or 0.0, 2),
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "status": c.status,
                "outcome": c.outcome,
                "sentiment": c.sentiment,
                "flag_reasons": flags,
                "caller_wav": str(caller_wav) if caller_wav.exists() else None,
                "agent_wav": str(agent_wav) if agent_wav.exists() else None,
                "transcript_json": str(transcript_json) if transcript_json.exists() else None,
            })
        print(json.dumps(results, indent=2, ensure_ascii=False))
        return

    print("=" * 80)
    print(f"🔍 CALL REVIEW QUEUE — {len(calls)} call(s) flagged for QA review (Newest First)")
    print("=" * 80)

    if not calls:
        print("✅ No calls currently flagged for review. Quality queue is clean!")
        print("=" * 80)
        return

    for idx, c in enumerate(calls, start=1):
        flags = json.loads(c.flag_reasons) if c.flag_reasons else []
        flags_str = ", ".join(f"[{f}]" for f in flags) if flags else "[needs_review]"

        caller_wav = BASE_DIR / "recordings" / f"{c.id}_caller.wav"
        if not caller_wav.exists():
            caller_wav = BASE_DIR / "recordings" / f"{c.id}.wav"
        agent_wav = BASE_DIR / "recordings" / f"{c.id}_agent.wav"
        transcript_json = BASE_DIR / "transcripts" / f"session_{c.id}.json"
        if not transcript_json.exists():
            transcript_json = BASE_DIR / "transcripts" / f"{c.id}.json"

        print(f"\n[{idx}] Call ID: {c.id}")
        print(f"    • Caller:       {mask_phone_number(c.caller_number)} ({c.direction or 'outbound'} via {c.provider or 'twilio'})")
        print(f"    • Duration:     {round(c.duration_sec or 0.0, 1)}s")
        print(f"    • Started:      {c.started_at.strftime('%Y-%m-%d %H:%M:%S UTC') if c.started_at else 'N/A'}")
        print(f"    • Sentiment:    {c.sentiment or 'N/A'} | Outcome: {c.outcome or 'N/A'}")
        print(f"    • Flag Reasons: \033[91m{flags_str}\033[0m")
        print(f"    • Caller Audio: {caller_wav if caller_wav.exists() else 'NOT FOUND'}")
        print(f"    • Agent Audio:  {agent_wav if agent_wav.exists() else 'NOT FOUND'}")
        print(f"    • Transcript:   {transcript_json if transcript_json.exists() else 'NOT FOUND'}")
    print("\n" + "=" * 80)


if __name__ == "__main__":
    json_mode = "--json" in sys.argv
    asyncio.run(print_review_queue(json_output=json_mode))
