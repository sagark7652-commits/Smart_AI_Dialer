"""Consent Logging and Verification for Indian & Global Telecom Regulations."""

from dataclasses import dataclass
import time
from typing import Any, Dict, List, Optional
from agent.logger import setup_logger

logger = setup_logger("governance.consent")


@dataclass
class ConsentRecord:
    call_id: str
    phone: str
    consent_type: str  # "recording", "callback", "contact", "marketing"
    status: str  # "granted", "refused", "revoked"
    timestamp: float
    channel: str = "voice_verbal"  # "voice_verbal", "dtmf", "sms"
    turn_text: Optional[str] = None


class ConsentManager:
    """Tracks explicit customer consent granting and revocations across calls."""

    _instance: Optional["ConsentManager"] = None

    def __init__(self) -> None:
        self._records: List[ConsentRecord] = []

    @classmethod
    def get_instance(cls) -> "ConsentManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def log_consent(
        self,
        call_id: str,
        phone: str,
        consent_type: str,
        status: str,
        channel: str = "voice_verbal",
        turn_text: Optional[str] = None,
    ) -> ConsentRecord:
        """Record customer consent state transition."""
        clean_phone = phone.strip()
        rec = ConsentRecord(
            call_id=call_id,
            phone=clean_phone,
            consent_type=consent_type.lower(),
            status=status.lower(),
            timestamp=time.time(),
            channel=channel,
            turn_text=turn_text,
        )
        self._records.append(rec)
        masked_phone = f"*********_{clean_phone[-4:]}" if len(clean_phone) >= 4 else "XXXX"
        logger.info(
            f"[CONSENT RECORDED] Call: {call_id} | Phone: {masked_phone} | "
            f"Type: {rec.consent_type} | Status: {rec.status} | Channel: {channel}"
        )
        return rec

    record_consent = log_consent

    def get_consents_for_phone(self, phone: str) -> List[Dict[str, Any]]:
        """Retrieve all consent events associated with a phone number."""
        clean = phone.strip()
        return [
            {
                "call_id": r.call_id,
                "phone": r.phone,
                "consent_type": r.consent_type,
                "status": r.status,
                "timestamp": r.timestamp,
                "channel": r.channel,
                "turn_text": r.turn_text,
            }
            for r in self._records
            if r.phone.endswith(clean[-10:])
        ]


def get_consent_manager() -> ConsentManager:
    return ConsentManager.get_instance()
