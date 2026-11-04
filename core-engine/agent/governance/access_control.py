"""Access Control and Short-Lived Signed URLs for Audio Recordings and Audit Logging."""

from dataclasses import dataclass
import hashlib
import hmac
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("governance.access")


@dataclass
class AuditLogEntry:
    timestamp: float
    user_or_key_id: str
    action: str  # "stream_recording", "export_data", "delete_data", "view_transcript"
    resource_id: str
    ip_address: Optional[str] = None
    details: Optional[str] = None


class RecordingAccessController:
    """Generates and validates time-bounded signed URLs for sensitive audio recordings."""

    def __init__(self, secret_key: Optional[str] = None, default_ttl_sec: int = 900) -> None:
        settings = get_settings()
        self.secret_key = secret_key or getattr(settings, "webhook_secret", "fallback-recording-secret-key")
        self.default_ttl_sec = default_ttl_sec  # Default 15 minutes
        self.audit_logs: List[AuditLogEntry] = []

    def generate_signed_url(
        self,
        call_id: str,
        track: str = "agent",  # "agent", "caller", or "combined"
        ttl_sec: Optional[int] = None,
        base_url: str = "http://localhost:8000",
    ) -> str:
        """Create a tamper-proof short-lived signed streaming URL."""
        ttl = ttl_sec or self.default_ttl_sec
        expires_at = int(time.time()) + ttl
        raw_msg = f"{call_id}:{track}:{expires_at}".encode("utf-8")
        sig = hmac.new(self.secret_key.encode("utf-8"), raw_msg, hashlib.sha256).hexdigest()

        return f"{base_url.rstrip('/')}/recordings/{call_id}/stream?track={track}&expires={expires_at}&signature={sig}"

    def verify_token(
        self,
        call_id: str,
        track: str,
        expires_at: int,
        provided_signature: str,
    ) -> bool:
        """Verify signature match and ensure expiration timestamp has not elapsed."""
        now = time.time()
        if now >= float(expires_at):
            logger.warning(f"Recording signed URL expired for call {call_id} (expired at {expires_at}, now {now})")
            return False

        raw_msg = f"{call_id}:{track}:{expires_at}".encode("utf-8")
        expected_sig = hmac.new(self.secret_key.encode("utf-8"), raw_msg, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_sig, provided_signature):
            logger.warning(f"Invalid signature on recording stream access attempt for call {call_id}")
            return False

        return True

    def log_access(
        self,
        user_or_key_id: str,
        action: str,
        resource_id: str,
        ip_address: Optional[str] = None,
        details: Optional[str] = None,
    ) -> None:
        """Append entry to audit trail."""
        entry = AuditLogEntry(
            timestamp=time.time(),
            user_or_key_id=user_or_key_id,
            action=action,
            resource_id=resource_id,
            ip_address=ip_address,
            details=details,
        )
        self.audit_logs.append(entry)
        logger.info(
            f"[AUDIT LOG] Actor: '{user_or_key_id}' | Action: '{action}' | Resource: '{resource_id}'"
        )

    def get_audit_trail(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve recent audit access logs."""
        return [
            {
                "timestamp": e.timestamp,
                "actor": e.user_or_key_id,
                "action": e.action,
                "resource_id": e.resource_id,
                "ip_address": e.ip_address,
                "details": e.details,
            }
            for e in reversed(self.audit_logs[-limit:])
        ]


# Singleton instance
_access_controller: Optional[RecordingAccessController] = None


def get_access_controller() -> RecordingAccessController:
    global _access_controller
    if _access_controller is None:
        _access_controller = RecordingAccessController()
    return _access_controller
