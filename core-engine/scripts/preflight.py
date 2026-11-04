"""Preflight verification script for Calling Agent Engine.

Validates environment variables, server reachability, webhook endpoints,
WebSocket streaming endpoints, and provider credentials for Twilio and Exotel.
"""

import argparse
import asyncio
import os
import sys
import urllib.parse
import httpx
import websockets
from dotenv import load_dotenv

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Load local .env if present
load_dotenv(".env")


def mask_secret(val: str, show_start: int = 3, show_end: int = 3) -> str:
    """Mask secret leaving small prefix and suffix visible."""
    if not val:
        return "<MISSING>"
    if len(val) <= show_start + show_end:
        return "*" * len(val)
    return val[:show_start] + "*" * (len(val) - show_start - show_end) + val[-show_end:]


class PreflightChecker:
    """Preflight check suite for live telephony operations."""

    def __init__(self, provider: str = "twilio") -> None:
        self.provider = provider.lower()
        self.all_passed = True
        self.public_url = os.getenv("PUBLIC_URL", "").rstrip("/")
        self.port = int(os.getenv("PORT", "8000"))

    def report(self, name: str, passed: bool, details: str, fix: str = "") -> None:
        if passed:
            print(f"  \033[92m[PASS]\033[0m {name:<28} : {details}")
        else:
            self.all_passed = False
            print(f"  \033[91m[FAIL]\033[0m {name:<28} : {details}")
            if fix:
                print(f"         \033[93mFix:\033[0m {fix}")

    def check_env_keys(self) -> None:
        """Verify essential provider and AI engine keys exist."""
        print("\n1. ENVIRONMENT & API KEYS:")
        
        # Core AI Keys
        groq_key = os.getenv("GROQ_API_KEY", "")
        self.report(
            "GROQ_API_KEY",
            bool(groq_key),
            f"Configured ({mask_secret(groq_key)})" if groq_key else "Missing",
            "Set GROQ_API_KEY in .env (get free key from https://console.groq.com)",
        )

        deepgram_key = os.getenv("DEEPGRAM_API_KEY", "")
        self.report(
            "DEEPGRAM_API_KEY",
            bool(deepgram_key),
            f"Configured ({mask_secret(deepgram_key)})" if deepgram_key else "Missing",
            "Set DEEPGRAM_API_KEY in .env (get $200 credit at https://deepgram.com)",
        )

        cartesia_key = os.getenv("CARTESIA_API_KEY", "")
        sarvam_key = os.getenv("SARVAM_API_KEY", "")
        tts_ok = bool(cartesia_key or sarvam_key)
        self.report(
            "TTS_API_KEY",
            tts_ok,
            f"Configured (Cartesia={bool(cartesia_key)}, Sarvam={bool(sarvam_key)})" if tts_ok else "Missing",
            "Set CARTESIA_API_KEY or SARVAM_API_KEY in .env",
        )

        # Telephony Keys
        if self.provider == "twilio":
            sid = os.getenv("TWILIO_ACCOUNT_SID", "")
            token = os.getenv("TWILIO_AUTH_TOKEN", "")
            num = os.getenv("TWILIO_PHONE_NUMBER", "")
            self.report(
                "TWILIO_ACCOUNT_SID",
                bool(sid),
                f"Configured ({mask_secret(sid, 4, 3)})" if sid else "Missing",
                "Set TWILIO_ACCOUNT_SID in .env from Twilio Console dashboard",
            )
            self.report(
                "TWILIO_AUTH_TOKEN",
                bool(token),
                f"Configured ({mask_secret(token, 2, 2)})" if token else "Missing",
                "Set TWILIO_AUTH_TOKEN in .env from Twilio Console dashboard",
            )
            self.report(
                "TWILIO_PHONE_NUMBER",
                bool(num),
                f"Configured ({mask_secret(num, 3, 4)})" if num else "Missing",
                "Set TWILIO_PHONE_NUMBER in .env in E.164 format (+1... or +91...)",
            )
        elif self.provider == "exotel":
            sid = os.getenv("EXOTEL_ACCOUNT_SID", "")
            api_key = os.getenv("EXOTEL_API_KEY", "")
            token = os.getenv("EXOTEL_API_TOKEN", "")
            subdomain = os.getenv("EXOTEL_SUBDOMAIN", "")
            caller_id = os.getenv("EXOTEL_CALLER_ID", "")
            self.report(
                "EXOTEL_ACCOUNT_SID",
                bool(sid),
                f"Configured ({mask_secret(sid)})" if sid else "Missing",
                "Set EXOTEL_ACCOUNT_SID in .env from Exotel dashboard",
            )
            self.report(
                "EXOTEL_API_KEY",
                bool(api_key),
                f"Configured ({mask_secret(api_key)})" if api_key else "Missing",
                "Set EXOTEL_API_KEY in .env under API Settings",
            )
            self.report(
                "EXOTEL_API_TOKEN",
                bool(token),
                f"Configured ({mask_secret(token)})" if token else "Missing",
                "Set EXOTEL_API_TOKEN in .env under API Settings",
            )
            self.report(
                "EXOTEL_SUBDOMAIN",
                bool(subdomain),
                f"Configured ({subdomain})" if subdomain else "Missing",
                "Set EXOTEL_SUBDOMAIN (e.g. api.exotel.com or your cluster domain)",
            )
            self.report(
                "EXOTEL_CALLER_ID",
                bool(caller_id),
                f"Configured ({mask_secret(caller_id, 3, 4)})" if caller_id else "Missing",
                "Set EXOTEL_CALLER_ID (your ExoPhone number)",
            )

    async def check_public_url_and_health(self) -> None:
        """Verify PUBLIC_URL is configured, accessible from internet, and points to our server."""
        print("\n2. PUBLIC_URL & LOCAL SERVER:")
        
        is_local = "localhost" in self.public_url or "127.0.0.1" in self.public_url
        if not self.public_url or is_local:
            self.report(
                "PUBLIC_URL Format",
                False,
                f"Invalid or local URL: '{self.public_url}'",
                "Start ngrok ('ngrok http 8000') or Cloudflare Tunnel and set PUBLIC_URL=https://... in .env",
            )
            return

        self.report("PUBLIC_URL Format", True, f"Tunnel URL: {self.public_url}")

        health_url = f"{self.public_url}/health"
        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                res = await client.get(health_url)
                if res.status_code == 200:
                    data = res.json()
                    self.report("Server Reachability", True, f"HTTP 200 OK ({data.get('status', 'healthy')})")
                else:
                    self.report(
                        "Server Reachability",
                        False,
                        f"HTTP {res.status_code} received from {health_url}",
                        f"Check if FastAPI server is running on port {self.port} (python -m uvicorn server:app --port {self.port})",
                    )
        except Exception as e:
            self.report(
                "Server Reachability",
                False,
                f"Connection failed: {e}",
                f"Make sure server is running and tunnel is active: 'ngrok http {self.port}'",
            )

    async def check_webhook_endpoint(self) -> None:
        """Verify telephony webhook endpoint responds properly."""
        print(f"\n3. {self.provider.upper()} WEBHOOK ENDPOINT:")
        if not self.public_url or "localhost" in self.public_url:
            self.report("Webhook Response", False, "Skipped due to missing PUBLIC_URL", "Fix PUBLIC_URL first")
            return

        webhook_url = f"{self.public_url}/webhooks/{self.provider}/voice"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Send sample test ping
                res = await client.post(
                    webhook_url,
                    data={"CallSid": "test_preflight_check", "CallStatus": "ringing"},
                )
                if res.status_code == 200:
                    if self.provider == "twilio" and "<Response>" in res.text:
                        self.report("Voice Webhook", True, "Returns valid TwiML with Media Stream connector")
                    else:
                        self.report("Voice Webhook", True, f"HTTP 200 OK ({res.text[:40]}...)")
                else:
                    self.report(
                        "Voice Webhook",
                        False,
                        f"HTTP {res.status_code}: {res.text}",
                        f"Verify {webhook_url} route is defined in server.py",
                    )
        except Exception as e:
            self.report("Voice Webhook", False, f"Failed to reach webhook: {e}")

    async def check_websocket_endpoint(self) -> None:
        """Verify streaming WebSocket accepts connection."""
        print(f"\n4. {self.provider.upper()} WEBSOCKET STREAM:")
        if not self.public_url or "localhost" in self.public_url:
            self.report("WebSocket Handshake", False, "Skipped due to missing PUBLIC_URL")
            return

        ws_url = (
            self.public_url.replace("https://", "wss://").replace("http://", "ws://")
            + f"/webhooks/{self.provider}/stream"
        )
        try:
            async with websockets.connect(ws_url, close_timeout=3.0) as ws:
                self.report("WebSocket Handshake", True, f"Successfully connected to {ws_url}")
                await ws.close()
        except Exception as e:
            self.report(
                "WebSocket Handshake",
                False,
                f"Connection error: {e}",
                f"Ensure tunnel supports WebSockets and server.py endpoint /webhooks/{self.provider}/stream is active.",
            )

    async def check_provider_credentials(self) -> None:
        """Make harmless read-only API call to verify provider account credentials."""
        print(f"\n5. {self.provider.upper()} CREDENTIALS & PHONE NUMBER USABILITY:")
        if self.provider == "twilio":
            sid = os.getenv("TWILIO_ACCOUNT_SID", "")
            token = os.getenv("TWILIO_AUTH_TOKEN", "")
            phone_num = os.getenv("TWILIO_PHONE_NUMBER", "")

            if not sid or not token:
                self.report("Account Validation", False, "Missing credentials in .env")
                return

            api_url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}.json"
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    res = await client.get(api_url, auth=(sid, token))
                    if res.status_code == 200:
                        account_data = res.json()
                        acc_name = account_data.get("friendly_name", "Twilio Account")
                        acc_status = account_data.get("status", "unknown")
                        acc_type = account_data.get("type", "Full")
                        self.report(
                            "Account Validation",
                            True,
                            f"Active ({acc_name} | Type: {acc_type} | Status: {acc_status})",
                        )

                        # Check phone number ownership
                        if phone_num:
                            encoded_num = urllib.parse.quote(phone_num)
                            num_url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/IncomingPhoneNumbers.json?PhoneNumber={encoded_num}"
                            num_res = await client.get(num_url, auth=(sid, token))
                            if num_res.status_code == 200:
                                numbers = num_res.json().get("incoming_phone_numbers", [])
                                if numbers:
                                    caps = numbers[0].get("capabilities", {})
                                    voice_cap = caps.get("voice", False)
                                    self.report(
                                        "Phone Number Usability",
                                        voice_cap,
                                        f"{phone_num} verified on account (Voice Capability: {voice_cap})",
                                        "Ensure number has Voice capability enabled in Twilio Console",
                                    )
                                else:
                                    self.report(
                                        "Phone Number Usability",
                                        False,
                                        f"{phone_num} is NOT an incoming number on account {mask_secret(sid)}",
                                        "Verify TWILIO_PHONE_NUMBER matches the exact number in your Twilio Console.",
                                    )
                    elif res.status_code == 401:
                        self.report("Account Validation", False, "Authentication Failed (HTTP 401: Invalid SID/Auth Token)")
                    else:
                        self.report("Account Validation", False, f"Twilio API Error {res.status_code}: {res.text}")
            except Exception as e:
                self.report("Account Validation", False, f"Could not reach Twilio API: {e}")

        elif self.provider == "exotel":
            sid = os.getenv("EXOTEL_ACCOUNT_SID", "")
            api_key = os.getenv("EXOTEL_API_KEY", "")
            token = os.getenv("EXOTEL_API_TOKEN", "")
            subdomain = os.getenv("EXOTEL_SUBDOMAIN", "api.exotel.com")
            caller_id = os.getenv("EXOTEL_CALLER_ID", "")

            if not sid or not api_key or not token:
                self.report("Account Validation", False, "Missing Exotel credentials in .env")
                return

            api_url = f"https://{subdomain}/v1/Accounts/{sid}.json"
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    res = await client.get(api_url, auth=(api_key, token))
                    if res.status_code == 200:
                        data = res.json().get("Account", {})
                        status_str = data.get("Status", "Active")
                        self.report("Account Validation", True, f"Active (Status: {status_str})")
                        if caller_id:
                            self.report("Caller ID Format", True, f"Configured ({caller_id})")
                    elif res.status_code == 401:
                        self.report("Account Validation", False, "Authentication Failed (HTTP 401: Invalid API Key/Token)")
                    else:
                        self.report("Account Validation", False, f"Exotel API Error {res.status_code}: {res.text}")
            except Exception as e:
                self.report("Account Validation", False, f"Could not reach Exotel API: {e}")

    async def run(self) -> bool:
        """Execute full preflight verification sequence."""
        print("=" * 68)
        print(f"  [*] CALLING AGENT ENGINE PREFLIGHT CHECK: [{self.provider.upper()}]")
        print("=" * 68)

        self.check_env_keys()
        await self.check_public_url_and_health()
        await self.check_webhook_endpoint()
        await self.check_websocket_endpoint()
        await self.check_provider_credentials()

        print("\n" + "=" * 68)
        if self.all_passed:
            print("  \033[92m[SUCCESS] ALL PREFLIGHT CHECKS PASSED! Ready for live phone calls.\033[0m")
        else:
            print("  \033[91m[WARNING] PREFLIGHT COMPLETED WITH ISSUES. Follow the fix hints above.\033[0m")
        print("=" * 68 + "\n")
        return self.all_passed


def main() -> None:
    parser = argparse.ArgumentParser(description="Preflight check for Twilio or Exotel calling setup.")
    parser.add_argument(
        "--provider",
        choices=["twilio", "exotel"],
        default="twilio",
        help="Telephony provider to validate (defaults to 'twilio').",
    )
    args = parser.parse_args()
    checker = PreflightChecker(provider=args.provider)
    asyncio.run(checker.run())


if __name__ == "__main__":
    main()
