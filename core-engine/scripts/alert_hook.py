"""CLI test script and trigger for system alerting.

Usage:
  python scripts/alert_hook.py --test
  python scripts/alert_hook.py --simulate-failures 3
"""

import argparse
import asyncio
from pathlib import Path
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.alerting import get_alert_manager

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main():
    parser = argparse.ArgumentParser(description="Calling Agent Alert Hook Tester")
    parser.add_argument("--test", action="store_true", help="Send a test alert immediately")
    parser.add_argument("--simulate-failures", type=int, default=0, help="Simulate N consecutive call failures")
    args = parser.parse_args()

    mgr = get_alert_manager()

    if args.test:
        print("[*] Sending test alert...")
        delivered = await mgr.dispatch_alert(
            level="WARNING",
            title="Manual Test Alert",
            message="This is a verified test alert from the Calling Agent Engine CLI.",
            context={"source": "scripts/alert_hook.py", "test_mode": True},
        )
        print(f"[+] Alert dispatch completed. Delivered: {delivered}")

    if args.simulate_failures > 0:
        print(f"[*] Simulating {args.simulate_failures} consecutive call failures...")
        for i in range(1, args.simulate_failures + 1):
            call_id = f"sim_fail_{i}"
            print(f"  - Failure {i}: recording for {call_id}...")
            await mgr.record_call_result(success=False, call_id=call_id, error_detail="Simulated telephony disconnect")
        print("[+] Simulation complete. Check logs or notification channel for alert delivery.")


if __name__ == "__main__":
    asyncio.run(main())
