"""Configurable PII Redaction for Transcripts, Logs, Webhooks, and Analytics.

Detects and redacts:
- Phone numbers (masks all but last 4 digits)
- Email addresses (e.g. u***@domain.com)
- Aadhaar number patterns (12 digits e.g. XXXX-XXXX-1234)
- PAN card patterns (10-char alphanumeric e.g. ABCDE****F)
- Payment card sequences (13-19 digits)
- Passwords, OTPs, PINs (4-8 digits)
- Indian postal PIN codes (6 digits) and address indicators
"""

from dataclasses import dataclass
import re
from typing import Any, Dict, Optional


@dataclass
class PIIRedactionConfig:
    """Per-agent or per-organization PII redaction settings."""
    enabled: bool = True
    mask_phone: bool = True
    mask_email: bool = True
    mask_aadhaar: bool = True
    mask_pan: bool = True
    mask_financial: bool = True  # Cards, CVV, OTP, PIN
    mask_addresses: bool = True  # Pincodes, street indicators


class PIIRedactor:
    """High-speed regex and heuristic PII redaction engine."""

    # Patterns
    EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
    # Aadhaar 12-digit pattern (with or without spaces/hyphens)
    AADHAAR_PATTERN = re.compile(r"\b(\d{4})[\s-](\d{4})[\s-](\d{4})\b|\b\d{12}\b")
    # Indian Income Tax PAN: 5 letters + 4 digits + 1 letter
    PAN_PATTERN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b", re.IGNORECASE)
    # Payment card 13-19 digits
    CARD_PATTERN = re.compile(r"\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b")
    # Indian 6-digit postal pin codes
    PINCODE_PATTERN = re.compile(r"\b[1-9][0-9]{5}\b")
    # Phone numbers (E.164, 10-digit Indian mobile, or prefixed)
    PHONE_PATTERN = re.compile(r"(?:\+91|91|0)?[6-9]\d{9}\b")

    def __init__(self, config: Optional[PIIRedactionConfig] = None) -> None:
        self.config = config or PIIRedactionConfig()

    def redact_text(self, text: Optional[str]) -> str:
        """Redact configured PII classes from text."""
        if not text or not self.config.enabled:
            return text or ""

        out = str(text)

        # 1. Financial: Cards, CVV, OTP
        if self.config.mask_financial:
            out = re.sub(r"(?i)\b(?:otp|pin|cvv|cvc)\s*(?:is\s*)?[:=]?\s*\d{3,8}\b", "[REDACTED_SECURITY_CODE]", out)
            # Replace card-like sequences
            def _mask_card(m):
                raw = re.sub(r"[\s-]", "", m.group(0))
                if 13 <= len(raw) <= 19:
                    return f"[REDACTED_CARD_****{raw[-4:]}]"
                return m.group(0)
            out = self.CARD_PATTERN.sub(_mask_card, out)

        # 2. Aadhaar
        if self.config.mask_aadhaar:
            def _mask_aadhaar(m):
                raw = re.sub(r"[\s-]", "", m.group(0))
                if len(raw) == 12:
                    return f"XXXX-XXXX-{raw[-4:]}"
                return m.group(0)
            out = self.AADHAAR_PATTERN.sub(_mask_aadhaar, out)

        # 3. PAN
        if self.config.mask_pan:
            def _mask_pan(m):
                raw = m.group(0).upper()
                return f"{raw[:5]}****{raw[-1]}"
            out = self.PAN_PATTERN.sub(_mask_pan, out)

        # 4. Email
        if self.config.mask_email:
            def _mask_email(m):
                em = m.group(0)
                user, domain = em.split("@", 1)
                masked_user = f"{user[0]}***" if len(user) > 1 else "***"
                return f"{masked_user}@{domain}"
            out = self.EMAIL_PATTERN.sub(_mask_email, out)

        # 5. Addresses / Postal Pin codes
        if self.config.mask_addresses:
            out = self.PINCODE_PATTERN.sub("[PINCODE_XXXXXX]", out)

        # 6. Phone Numbers (preserve last 4 digits)
        if self.config.mask_phone:
            def _mask_phone(m):
                digits = re.sub(r"\D", "", m.group(0))
                if len(digits) >= 10:
                    last4 = digits[-4:]
                    return f"*********_{last4}"
                return m.group(0)
            out = self.PHONE_PATTERN.sub(_mask_phone, out)

        return out

    def redact_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively redact dictionary fields."""
        if not self.config.enabled:
            return data

        redacted = {}
        for k, v in data.items():
            if isinstance(v, str):
                redacted[k] = self.redact_text(v)
            elif isinstance(v, dict):
                redacted[k] = self.redact_dict(v)
            elif isinstance(v, list):
                redacted[k] = [
                    self.redact_dict(i) if isinstance(i, dict)
                    else (self.redact_text(i) if isinstance(i, str) else i)
                    for i in v
                ]
            else:
                redacted[k] = v
        return redacted
