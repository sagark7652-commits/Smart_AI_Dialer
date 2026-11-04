"""HMAC-Signed Webhook Dispatcher with Exponential Backoff."""

import asyncio
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional
import httpx
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("webhooks")


def compute_hmac_signature(payload_bytes: bytes, secret: str) -> str:
    """Compute hex HMAC SHA-256 digest of payload."""
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


def verify_hmac_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    """Verify HMAC signature header (supports raw hex or 'sha256=<hex>')."""
    expected = compute_hmac_signature(payload_bytes, secret)
    clean_sig = signature_header.replace("sha256=", "").strip()
    return hmac.compare_digest(expected, clean_sig)


class WebhookDispatcher:
    """Dispatches result webhooks asynchronously with SHA-256 HMAC and exponential backoff."""

    def __init__(self, secret: Optional[str] = None) -> None:
        self.secret = secret or get_settings().webhook_secret

    async def dispatch_call_result(
        self,
        target_url: str,
        payload: Dict[str, Any],
        max_retries: int = 3,
        backoff_sec: float = 0.5,
    ) -> bool:
        """Send JSON payload signed with HMAC header to target URL."""
        if not target_url:
            return False

        payload_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        timestamp = str(int(time.time()))
        signature = compute_hmac_signature(payload_bytes, self.secret)

        headers = {
            "Content-Type": "application/json",
            "X-Calling-Agent-Signature": f"sha256={signature}",
            "X-Calling-Agent-Timestamp": timestamp,
        }

        attempt = 0
        current_delay = backoff_sec

        while attempt < max_retries:
            attempt += 1
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(target_url, content=payload_bytes, headers=headers)
                    if 200 <= resp.status_code < 300:
                        logger.info(f"Webhook delivered successfully to {target_url} on attempt {attempt}")
                        return True
                    else:
                        logger.warning(
                            f"Webhook to {target_url} returned HTTP {resp.status_code} (Attempt {attempt}/{max_retries})"
                        )
            except Exception as e:
                logger.warning(f"Webhook attempt {attempt} failed for {target_url}: {e}")

            if attempt < max_retries:
                await asyncio.sleep(current_delay)
                current_delay *= 2.0

        logger.error(f"Webhook delivery failed permanently to {target_url} after {max_retries} attempts.")
        return False
