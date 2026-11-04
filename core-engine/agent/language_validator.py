"""Ultra-fast (<10ms) Runtime Language Validator and Strict Language Lock Enforcer."""

from dataclasses import dataclass
import re
import time
from typing import List, Optional, Tuple


@dataclass
class ValidationResult:
    valid: bool
    expected_lang: str
    detected_lang: str
    violation_reason: Optional[str] = None
    execution_time_ms: float = 0.0


class LanguageValidator:
    """Validates generated LLM responses against the strict locked target language."""

    # Common Marathi marker words that do not exist in standard Hindi
    MARATHI_MARKERS = {
        "आहे", "आहेत", "नाही", "नाहीत", "काय", "तुम्ही", "आपण", "मला", "आम्हाला",
        "होय", "केले", "सांगा", "करा", "जावो", "करावे", "मिळेल", "येथे", "कसे",
        "झाले", "झाली", "झाला", "त्यांचे", "त्यांची", "यांचे", "यांची", "कॉल", "कराल"
    }

    # Common Hindi marker words that do not exist in natural spoken Marathi
    HINDI_MARKERS = {
        "है", "हैं", "हूँ", "था", "थी", "थे", "आप", "मुझे", "हमे", "हमें",
        "रहा", "रही", "रहे", "करना", "कीजिए", "बताइए", "सकती", "सकते", "सकता",
        "बात", "होगा", "होगी", "देंगे", "लेंगे", "दूँ", "लूँ"
    }

    # Devanagari Unicode range
    DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")

    # Banned Hinglish / Hindi filler words in strict Indian English
    BANNED_IN_ENGLISH = re.compile(
        r"(?i)\b(accha|acha|arre|arrey|theek|thik|haan|batao|karo|nahin|nahi|namaste|dhanyavaad|bhai|sahab|ji)\b"
    )

    @classmethod
    def validate(cls, text: str, target_lang: str) -> ValidationResult:
        """Evaluate text against target language constraints in under 5ms."""
        t0 = time.perf_counter()
        if not text or not text.strip():
            return ValidationResult(
                valid=True,
                expected_lang=target_lang,
                detected_lang=target_lang,
                execution_time_ms=(time.perf_counter() - t0) * 1000,
            )

        target = (target_lang or "en").split("-")[0].lower()
        clean = text.strip()
        words = [w.strip(".,!?;:\"'()[]{}") for w in clean.split()]
        devanagari_chars = len(cls.DEVANAGARI_PATTERN.findall(clean))
        total_chars = max(len(clean), 1)
        devanagari_ratio = devanagari_chars / total_chars

        # Rule 1: STRICT ENGLISH LOCK
        if target == "en":
            # Must NOT contain Devanagari characters
            if devanagari_ratio > 0.05:
                return ValidationResult(
                    valid=False,
                    expected_lang="en",
                    detected_lang="hi/mr",
                    violation_reason=f"Devanagari characters detected ({devanagari_ratio:.1%}) in strict English mode.",
                    execution_time_ms=(time.perf_counter() - t0) * 1000,
                )
            # Must NOT contain banned Hindi/Hinglish words
            banned_match = cls.BANNED_IN_ENGLISH.search(clean)
            if banned_match:
                return ValidationResult(
                    valid=False,
                    expected_lang="en",
                    detected_lang="hinglish",
                    violation_reason=f"Hinglish code-mixing word '{banned_match.group(0)}' detected in strict English mode.",
                    execution_time_ms=(time.perf_counter() - t0) * 1000,
                )
            return ValidationResult(
                valid=True,
                expected_lang="en",
                detected_lang="en",
                execution_time_ms=(time.perf_counter() - t0) * 1000,
            )

        # Rule 2: STRICT MARATHI LOCK
        if target == "mr":
            # Must be primarily in Devanagari script (>30% of characters)
            if devanagari_ratio < 0.25:
                return ValidationResult(
                    valid=False,
                    expected_lang="mr",
                    detected_lang="latin",
                    violation_reason=f"Script violation: Marathi must be in Devanagari script, but received Latin script ({devanagari_ratio:.1%} Devanagari).",
                    execution_time_ms=(time.perf_counter() - t0) * 1000,
                )
            # Check Hindi marker words slipping into Marathi
            hindi_hits = [w for w in words if w in cls.HINDI_MARKERS]
            marathi_hits = [w for w in words if w in cls.MARATHI_MARKERS]
            if len(hindi_hits) >= 2 and len(hindi_hits) > len(marathi_hits):
                return ValidationResult(
                    valid=False,
                    expected_lang="mr",
                    detected_lang="hi",
                    violation_reason=f"Hindi grammatical markers detected in Marathi response: {hindi_hits[:3]}",
                    execution_time_ms=(time.perf_counter() - t0) * 1000,
                )
            return ValidationResult(
                valid=True,
                expected_lang="mr",
                detected_lang="mr",
                execution_time_ms=(time.perf_counter() - t0) * 1000,
            )

        # Rule 3: STRICT HINDI LOCK
        if target == "hi":
            # If Devanagari, ensure it does not use distinctive Marathi verb markers
            if devanagari_ratio >= 0.25:
                marathi_hits = [w for w in words if w in cls.MARATHI_MARKERS]
                if len(marathi_hits) >= 2:
                    return ValidationResult(
                        valid=False,
                        expected_lang="hi",
                        detected_lang="mr",
                        violation_reason=f"Marathi grammatical markers detected in Hindi response: {marathi_hits[:3]}",
                        execution_time_ms=(time.perf_counter() - t0) * 1000,
                    )
            return ValidationResult(
                valid=True,
                expected_lang="hi",
                detected_lang="hi",
                execution_time_ms=(time.perf_counter() - t0) * 1000,
            )

        return ValidationResult(
            valid=True,
            expected_lang=target_lang,
            detected_lang=target_lang,
            execution_time_ms=(time.perf_counter() - t0) * 1000,
        )

    @classmethod
    def get_repair_instruction(cls, target_lang: str, reason: str) -> str:
        """Generate high-priority correction prompt for immediate one-turn LLM regeneration."""
        target = (target_lang or "en").split("-")[0].lower()
        if target == "en":
            return "SYSTEM CORRECTION: You violated the language lock. Reply strictly in clean Indian English only. Do NOT use any Hindi or Hinglish words."
        elif target == "mr":
            return "SYSTEM CORRECTION: You violated the language lock. Reply strictly in natural spoken Marathi (मराठी) in Devanagari script only. Do NOT use Hindi words like 'है', 'कीजिए', or 'बताइए'."
        else:
            return "SYSTEM CORRECTION: You violated the language lock. Reply strictly in natural spoken Hindi in Devanagari script only."
