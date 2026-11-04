"""Outbound call placement script supporting Twilio and Exotel with live status tracking."""

import argparse
import asyncio
import sys
import time
from agent.config import get_settings
from agent.db import get_db
from agent.logger import setup_logger
from agent.telephony.factory import get_telephony_provider

logger = setup_logger("call_cli")

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def place_call(
    to_number: str,
    agent_config: str = "agent_config.yaml",
    provider_override: str = None,
    monitor: bool = True,
) -> None:
    settings = get_settings()
    provider_name = (provider_override or settings.telephony_provider).lower()
    telephony = get_telephony_provider(provider_name)
    db = get_db()
    await db.init_db()

    public_url = settings.public_url.rstrip("/")
    if "localhost" in public_url or "127.0.0.1" in public_url:
        print("\n" + "=" * 65)
        print("WARNING: PUBLIC_URL in .env is set to localhost.")
        print("Telephony providers (Twilio/Exotel) cannot connect to localhost.")
        print("Please start ngrok (or Cloudflare Tunnel):")
        print("  ngrok http 8000")
        print("Then update PUBLIC_URL in .env with your https:// ngrok URL.")
        print("=" * 65 + "\n")

    print("\n" + "=" * 65)
    print(f"      INITIATING OUTBOUND CALL VIA {provider_name.upper()}      ")
    print(f" Destination     : {to_number}")
    print(f" Agent Config    : {agent_config}")
    print(f" Webhook Base    : {public_url}")
    print("=" * 65)

    webhook_url = f"{public_url}/webhooks/{provider_name}/voice"
    status_callback_url = f"{public_url}/webhooks/{provider_name}/status"

    try:
        call_sid = await telephony.make_call(
            to_number=to_number,
            webhook_url=webhook_url,
            status_callback_url=status_callback_url,
        )
        print(f"\n[+] Outbound call initiated successfully!")
        print(f"Call SID         : {call_sid}")
        print(f"Provider         : {provider_name.upper()}")
        print(f"Webhook URL      : {webhook_url}")
        print(f"Status Callback  : {status_callback_url}")

        # Record in database
        await db.create_call(
            call_id=call_sid,
            caller_number=to_number,
            agent_id="default_agent",
            direction="outbound",
            provider=provider_name,
            status="initiated",
        )

        if not monitor:
            print("\nCall initiated in background. Monitor via /calls API or server logs.\n")
            return

        print("\n--- Live Call Status Monitor (Press Ctrl+C to stop monitoring) ---")
        last_status = "initiated"
        start_time = time.time()
        while time.time() - start_time < 300:  # Monitor for up to 5 minutes
            await asyncio.sleep(2.0)
            call_record = await db.get_call(call_sid)
            if call_record and call_record.status != last_status:
                last_status = call_record.status
                ts = time.strftime("%H:%M:%S")
                print(f"[{ts}] Call State Changed: -> \033[96m{last_status.upper()}\033[0m")
                if last_status in ("completed", "failed", "busy", "no-answer", "canceled"):
                    print(f"\nCall concluded with status: {last_status}")
                    break

    except Exception as e:
        print(f"\n[!] Call initiation failed: {e}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Place outbound phone call via Twilio or Exotel.")
    parser.add_argument("phone_number", help="Destination phone number with country code, e.g. +919876543210")
    parser.add_argument(
        "--agent",
        default="agent_config.yaml",
        help="Path to agent configuration YAML file (default: agent_config.yaml).",
    )
    parser.add_argument(
        "--provider",
        choices=["twilio", "exotel"],
        help="Optional telephony provider override (defaults to TELEPHONY_PROVIDER in .env).",
    )
    parser.add_argument(
        "--no-monitor",
        action="store_true",
        help="Do not monitor live call status after dispatch.",
    )
    args = parser.parse_args()
    asyncio.run(
        place_call(
            to_number=args.phone_number,
            agent_config=args.agent,
            provider_override=args.provider,
            monitor=not args.no_monitor,
        )
    )


if __name__ == "__main__":
    main()
