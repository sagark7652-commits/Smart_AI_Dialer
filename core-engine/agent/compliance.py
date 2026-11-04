"""DND Registry and Calling Hours Compliance Engine."""

from datetime import datetime, timezone, timedelta
from typing import Optional, Protocol
from agent.db import get_db
from agent.logger import setup_logger

logger = setup_logger("compliance")

# IST Offset is UTC + 5 hours 30 minutes
IST_OFFSET = timezone(timedelta(hours=5, minutes=30))


class DNDRegistryHook(Protocol):
    """Extensible protocol for external TRAI or carrier DND scrubbing providers."""

    async def is_blacklisted(self, phone_number: str) -> bool:
        ...


class ComplianceEngine:
    """Validates TRAI / telecom compliance rules: DND checking & permitted calling windows."""

    def __init__(self, external_hook: Optional[DNDRegistryHook] = None) -> None:
        self.db = get_db()
        self.external_hook = external_hook

    def is_within_calling_window(
        self,
        dt_utc: Optional[datetime] = None,
        start_hour: int = 9,
        end_hour: int = 20,
    ) -> bool:
        """Check if current time is within permitted Indian telemarketing hours (09:00 - 20:00 IST)."""
        now = dt_utc or datetime.now(timezone.utc)
        ist_now = now.astimezone(IST_OFFSET)
        current_hour = ist_now.hour
        return start_hour <= current_hour < end_hour

    async def check_dnd(self, phone_number: str) -> bool:
        """Return True if phone number is registered in internal DND registry or external hook."""
        # 1. Internal DB registry check
        is_internal_dnd = await self.db.is_dnd(phone_number)
        if is_internal_dnd:
            return True

        # 2. External hook check (if configured)
        if self.external_hook:
            try:
                return await self.external_hook.is_blacklisted(phone_number)
            except Exception as e:
                logger.error(f"External DND hook error for {phone_number}: {e}")

        return False

    async def validate_outbound_call(
        self,
        phone_number: str,
        enforce_calling_hours: bool = True,
        start_hour: int = 9,
        end_hour: int = 20,
    ) -> tuple[bool, Optional[str]]:
        """Pre-flight compliance check before initiating an outbound call.

        Returns (is_allowed, rejection_reason).
        """
        # 1. Check DND status first (DND blacklist takes absolute precedence)
        if await self.check_dnd(phone_number):
            reason = f"Call blocked: Destination number '{phone_number}' is registered on the Do Not Disturb (DND) list."
            logger.warning(f"Compliance violation: {reason}")
            return False, reason

        # 2. Check calling hours
        if enforce_calling_hours and not self.is_within_calling_window(start_hour=start_hour, end_hour=end_hour):
            ist_now = datetime.now(timezone.utc).astimezone(IST_OFFSET).strftime("%H:%M IST")
            reason = f"Call blocked: Current time ({ist_now}) is outside allowed calling hours ({start_hour:02d}:00 - {end_hour:02d}:00 IST)."
            logger.warning(f"Compliance violation: {reason}")
            return False, reason
            reason = f"Call blocked: Number {phone_number} is registered on the Do Not Disturb (DND) list."
            logger.warning(f"Compliance violation: {reason}")
            return False, reason

        return True, None


_compliance_engine: Optional[ComplianceEngine] = None


def get_compliance_engine() -> ComplianceEngine:
    global _compliance_engine
    if _compliance_engine is None:
        _compliance_engine = ComplianceEngine()
    return _compliance_engine
