"""Alert notification dispatcher for system failures and consecutive call errors.

Config-driven via environment variables (.env):
- ALERT_WEBHOOK_URL (Slack, Discord, or generic incoming webhook)
- TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
"""

import asyncio
from datetime import datetime, timezone
import os
from typing import Any, Dict, Optional
import httpx
from agent.logger import setup_logger

logger = setup_logger("alerting")


class AlertManager:
    """Monitors call success rates and dispatches alerts upon consecutive failures or unhandled crashes."""

    def __init__(self) -> None:
        self.webhook_url = os.getenv("ALERT_WEBHOOK_URL")
        self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.failure_threshold = int(os.getenv("ALERT_FAILURE_THRESHOLD", "3"))
        self._consecutive_failures = 0
        self._lock = asyncio.Lock()

    @property
    def consecutive_failures(self) -> int:
        return self._consecutive_failures

    async def record_call_result(self, success: bool, call_id: str, error_detail: str = "") -> None:
        """Track call completion status. Trigger alert if consecutive failures reach threshold."""
        async with self._lock:
            if success:
                if self._consecutive_failures > 0:
                    logger.info(f"Call {call_id} succeeded. Resetting failure counter (was {self._consecutive_failures}).")
                self._consecutive_failures = 0
                return

            self._consecutive_failures += 1
            logger.warning(
                f"Call {call_id} failed. Consecutive failures: {self._consecutive_failures}/{self.failure_threshold}. Reason: {error_detail}"
            )

            if self._consecutive_failures >= self.failure_threshold:
                await self.dispatch_alert(
                    level="CRITICAL",
                    title=f"Call Engine Alert: {self._consecutive_failures} Consecutive Call Failures",
                    message=(
                        f"The calling agent engine has encountered {self._consecutive_failures} consecutive call errors. "
                        f"Latest failed call_id: {call_id}. Error: {error_detail}"
                    ),
                    context={
                        "consecutive_failures": self._consecutive_failures,
                        "latest_call_id": call_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

    async def dispatch_alert(
        self,
        level: str,
        title: str,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Send notification via configured webhook or Telegram without crashing caller."""
        delivered = False
        payload = {
            "level": level,
            "title": title,
            "message": message,
            "context": context or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # 1. Generic Webhook (Slack / Discord / Teams)
        if self.webhook_url:
            try:
                # Format for Slack incoming webhooks
                slack_body = {
                    "text": f"*{level}* - {title}\n{message}\n`Context: {context}`"
                }
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(self.webhook_url, json=slack_body)
                    if resp.status_code in (200, 204):
                        logger.info(f"Alert webhook delivered successfully ({level}: {title})")
                        delivered = True
                    else:
                        logger.warning(f"Alert webhook responded with status {resp.status_code}")
            except Exception as e:
                logger.error(f"Failed to deliver alert webhook: {e}")

        # 2. Telegram Bot
        if self.telegram_bot_token and self.telegram_chat_id:
            try:
                tg_url = f"https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage"
                tg_text = f"🚨 *{level}*: {title}\n\n{message}"
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(
                        tg_url,
                        json={"chat_id": self.telegram_chat_id, "text": tg_text, "parse_mode": "Markdown"},
                    )
                    if resp.status_code == 200:
                        logger.info(f"Telegram alert delivered ({title})")
                        delivered = True
                    else:
                        logger.warning(f"Telegram API responded with {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Failed to deliver Telegram alert: {e}")

        if not self.webhook_url and not (self.telegram_bot_token and self.telegram_chat_id):
            logger.info(f"[LOCAL ALERT FALLBACK] [{level}] {title} - {message}")

        return delivered


_alert_mgr: Optional[AlertManager] = None


def get_alert_manager() -> AlertManager:
    """Return singleton AlertManager instance."""
    global _alert_mgr
    if _alert_mgr is None:
        _alert_mgr = AlertManager()
    return _alert_mgr
