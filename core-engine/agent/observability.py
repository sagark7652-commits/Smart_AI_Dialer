"""Observability, Sentry integration, and Alerting Dispatcher."""

from datetime import datetime, timezone
import json
from typing import Any, Dict, Optional
import httpx
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("observability")


class AlertDispatcher:
    """Dispatches real-time alerts for critical telephony or pipeline failures."""

    def __init__(self, alert_webhook_url: Optional[str] = None) -> None:
        self.webhook_url = alert_webhook_url
        self.settings = get_settings()

    async def send_critical_alert(
        self,
        event_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Send urgent notification to external webhook or logging pipeline."""
        payload = {
            "severity": "CRITICAL",
            "event_type": event_type,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "env": self.settings.app_env,
        }

        logger.error(f"🚨 CRITICAL ALERT [{event_type}]: {message}")

        if not self.webhook_url:
            return False

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(self.webhook_url, json=payload)
                return 200 <= res.status_code < 300
        except Exception as e:
            logger.error(f"Failed to dispatch alert webhook: {e}")
            return False


_alert_dispatcher: Optional[AlertDispatcher] = None


def get_alert_dispatcher() -> AlertDispatcher:
    global _alert_dispatcher
    if _alert_dispatcher is None:
        _alert_dispatcher = AlertDispatcher()
    return _alert_dispatcher
