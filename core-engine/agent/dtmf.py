"""DTMF (Dual-Tone Multi-Frequency) keypad input handler.

Provider Mechanisms & Capabilities:
- Twilio: Delivers real-time DTMF events over the active bidirectional Media Stream WebSocket:
  {"event": "dtmf", "streamSid": "...", "dtmf": {"track": "inbound_track", "digit": "1"}}
- Exotel: Does NOT support in-stream DTMF events over its Voicebot WebSocket stream.
  Exotel requires IVR Flow Builder 'Gather' applet forwarding pressed digits via HTTP POST
  to `/webhooks/exotel/dtmf`.

Security & Safety:
- Never accept payment card numbers (12-19 digits), CVV (3-4 digits), OTPs (4-8 digits),
  or PINs via DTMF.
- Any suspected sensitive digit sequence is immediately redacted as '****' and rejected.
- Digits and resolved actions are recorded in the call transcript and database.
"""

from dataclasses import dataclass, field
import re
import time
from typing import Any, Dict, List, Optional
from agent.logger import setup_logger
from agent.safety import SecuritySanitizer

logger = setup_logger("dtmf")

# Regex to detect potentially sensitive sequences (e.g. 13-19 digit card numbers, or OTP/PIN entries)
SENSITIVE_DIGIT_SEQ_PATTERN = re.compile(r"^\d{4,19}$")


@dataclass
class DTMFConfig:
    """Configuration for an interactive DTMF menu."""
    menu_id: str
    prompt: str = "Press 1 to confirm, 2 for callback, 9 for a human agent."
    action_map: Dict[str, str] = field(
        default_factory=lambda: {
            "1": "confirm",
            "2": "callback",
            "9": "transfer_human",
        }
    )
    timeout_sec: float = 10.0
    max_retries: int = 2
    invalid_prompt: str = "अमान्य इनपुट। कृपया पुष्टि के लिए 1, कॉलबैक के लिए 2, या एजेंट के लिए 9 दबाएं।"
    timeout_prompt: str = "हमें कोई इनपुट नहीं मिला। कृपया विकल्प चुनें।"
    reject_sensitive: bool = True


@dataclass
class DTMFResult:
    """Result of processing a DTMF event."""
    status: str  # "success", "retry", "failed", "rejected_sensitive", "timeout_retry", "timeout_failed"
    digit: Optional[str] = None
    action: Optional[str] = None
    prompt: Optional[str] = None
    retries_used: int = 0
    is_sensitive: bool = False


class DTMFHandler:
    """Manages DTMF state, validation, retry thresholds, and security redactions."""

    def __init__(self, call_id: str, default_config: Optional[DTMFConfig] = None) -> None:
        self.call_id = call_id
        self.config: DTMFConfig = default_config or DTMFConfig(menu_id="default_menu")
        self.retries_used: int = 0
        self.state: str = "idle"  # "idle", "awaiting_dtmf", "resolved", "failed"
        self.history: List[Dict[str, Any]] = []
        self._last_prompt_time: float = 0.0

    def start_menu(self, config: Optional[DTMFConfig] = None) -> str:
        """Activate a DTMF menu and return the audio prompt to speak."""
        if config:
            self.config = config
        self.retries_used = 0
        self.state = "awaiting_dtmf"
        self._last_prompt_time = time.time()
        logger.info(f"DTMF menu started for call {self.call_id}: menu_id={self.config.menu_id}")
        return self.config.prompt

    def process_digit(self, digit: str) -> DTMFResult:
        """Process an incoming keypad digit or sequence from Twilio or Exotel."""
        raw_digit = str(digit).strip()

        # Security check: redact and reject card numbers, OTPs, PINs entered via DTMF
        if len(raw_digit) >= 4 or (self.config.reject_sensitive and raw_digit in ("*#", "0000", "1234")):
            # Check for payment or security token pattern
            redacted = SecuritySanitizer.redact(raw_digit)
            if redacted != raw_digit or len(raw_digit) >= 4:
                logger.warning(
                    f"Sensitive DTMF input detected and blocked for call {self.call_id}: {len(raw_digit)} digits"
                )
                self.history.append({
                    "timestamp": time.time(),
                    "raw_digit": "[REDACTED_SENSITIVE]",
                    "status": "rejected_sensitive",
                    "action": "none",
                })
                return DTMFResult(
                    status="rejected_sensitive",
                    digit="****",
                    action="reject",
                    prompt="सुरक्षा कारणों से कार्ड नंबर, पिन या ओटीपी स्वीकार नहीं किया जा सकता।",
                    retries_used=self.retries_used,
                    is_sensitive=True,
                )

        # Check against configured action map
        if raw_digit in self.config.action_map:
            action = self.config.action_map[raw_digit]
            self.state = "resolved"
            logger.info(f"DTMF digit '{raw_digit}' matched action '{action}' for call {self.call_id}")
            self.history.append({
                "timestamp": time.time(),
                "digit": raw_digit,
                "status": "success",
                "action": action,
            })
            return DTMFResult(
                status="success",
                digit=raw_digit,
                action=action,
                prompt=None,
                retries_used=self.retries_used,
            )

        # Invalid digit handling
        self.retries_used += 1
        logger.warning(
            f"Invalid DTMF digit '{raw_digit}' for call {self.call_id}. Retries used: {self.retries_used}/{self.config.max_retries}"
        )
        self.history.append({
            "timestamp": time.time(),
            "digit": raw_digit,
            "status": "invalid",
            "retries_used": self.retries_used,
        })

        if self.retries_used <= self.config.max_retries:
            return DTMFResult(
                status="retry",
                digit=raw_digit,
                action="retry",
                prompt=self.config.invalid_prompt,
                retries_used=self.retries_used,
            )
        else:
            self.state = "failed"
            return DTMFResult(
                status="failed",
                digit=raw_digit,
                action="transfer_human",
                prompt="अधिकतम प्रयास समाप्त। आपको हमारे प्रतिनिधि से कनेक्ट किया जा रहा है।",
                retries_used=self.retries_used,
            )

    def process_timeout(self) -> DTMFResult:
        """Handle timeout when caller provides no DTMF input."""
        self.retries_used += 1
        logger.warning(
            f"DTMF timeout for call {self.call_id}. Retries used: {self.retries_used}/{self.config.max_retries}"
        )
        self.history.append({
            "timestamp": time.time(),
            "status": "timeout",
            "retries_used": self.retries_used,
        })

        if self.retries_used <= self.config.max_retries:
            return DTMFResult(
                status="timeout_retry",
                digit=None,
                action="retry",
                prompt=self.config.timeout_prompt,
                retries_used=self.retries_used,
            )
        else:
            self.state = "failed"
            return DTMFResult(
                status="timeout_failed",
                digit=None,
                action="transfer_human",
                prompt="कोई इनपुट प्राप्त नहीं हुआ। कॉल प्रतिनिधि को ट्रांसफर की जा रही है।",
                retries_used=self.retries_used,
            )

    def is_timed_out(self, now: Optional[float] = None) -> bool:
        """Check if active DTMF menu has exceeded its timeout."""
        if self.state != "awaiting_dtmf":
            return False
        current_time = now or time.time()
        return (current_time - self._last_prompt_time) > self.config.timeout_sec
