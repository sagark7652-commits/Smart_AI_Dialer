"""Language definitions and configurations.

Adding a new language requires adding a LanguageConfig entry to SUPPORTED_LANGUAGES.
"""

from dataclasses import dataclass
import re
from typing import Dict, Optional


@dataclass(frozen=True)
class LanguageConfig:
    """Configuration metadata for a supported spoken language."""

    code: str  # Primary BCP-47 identifier e.g., 'hi-IN'
    short_code: str  # Short identifier e.g., 'hi'
    name: str  # Human-readable name e.g., 'Hindi'
    stt_code: str  # Deepgram/Sarvam/Google STT language tag
    tts_locale: str  # Default TTS locale
    prompt_instruction: str  # Guidance for LLM code-switching and vocabulary


# Supported languages registry: Hindi, English, Marathi (with Hinglish handling)
SUPPORTED_LANGUAGES: Dict[str, LanguageConfig] = {
    "en": LanguageConfig(
        code="en-US",
        short_code="en",
        name="English",
        stt_code="en",
        tts_locale="en-US",
        prompt_instruction="Respond in natural Indian English or conversational English.",
    ),
    "hi": LanguageConfig(
        code="hi-IN",
        short_code="hi",
        name="Hindi",
        stt_code="hi",
        tts_locale="hi-IN",
        prompt_instruction="Respond in conversational Hindi. Natural conversational Hinglish (Hindi mixed with everyday English loan words) is encouraged when common.",
    ),
    "mr": LanguageConfig(
        code="mr-IN",
        short_code="mr",
        name="Marathi",
        stt_code="mr",
        tts_locale="mr-IN",
        prompt_instruction="Respond in natural, polite spoken Marathi. Common English loan words are acceptable when conversational.",
    ),
}

# Alias mapping for lookup flexibility
LANGUAGE_ALIASES: Dict[str, str] = {
    "en": "en",
    "en-us": "en",
    "en-in": "en",
    "english": "en",
    "hi": "hi",
    "hi-in": "hi",
    "hindi": "hi",
    "hinglish": "hi",
    "mr": "mr",
    "mr-in": "mr",
    "marathi": "mr",
}


def get_language(query: str) -> Optional[LanguageConfig]:
    """Retrieve LanguageConfig by code, alias, or name."""
    normalized = query.strip().lower()
    canonical_key = LANGUAGE_ALIASES.get(normalized)
    if canonical_key:
        return SUPPORTED_LANGUAGES.get(canonical_key)
    return None


def get_default_language() -> LanguageConfig:
    """Return the default language fallback (English)."""
    return SUPPORTED_LANGUAGES["en"]


def detect_language(text: str) -> LanguageConfig:
    """Lightweight heuristic to detect Hindi, Marathi, or English/Hinglish."""
    if not text:
        return get_default_language()

    # Distinctive Marathi markers (Devanagari and Latin Romanized)
    marathi_markers = [
        "आहे", "नाही", "काय", "किती", "नमस्कार", "कसे", "करा", "होय", "सांगा", "कुठे",
        "केव्हा", "हवे", "कसं", "कशा", "मला", "तुम्हाला", "आम्ही", "दवाखाना", "वेळ",
        "aahe", "nahi", "kay", "kiti", "namaskar", "kase", "kasa", "ahes", "kuthe", "sanga",
        "mala", "tumhala", "amhi", "davakhana", "vel"
    ]
    # Distinctive Hindi markers (Devanagari and Latin Romanized)
    hindi_markers = [
        "है", "क्या", "नमस्ते", "कैसे", "किस्मत", "मदद", "बताइए", "चाहिए", "कितना",
        "कहाँ", "कब", "मुझे", "आपको", "हम", "बहुत", "अच्छा", "समय",
        "hai", "kya", "namaste", "kaise", "madad", "bataiye", "chahiye", "kitna", "kahan",
        "kab", "mujhe", "aapko", "bahut", "accha", "karo"
    ]

    lower_text = text.lower()
    
    # Common English words check to prevent false-positive switching on standard conversational English
    english_words = {
        "okay", "ok", "tell", "me", "yes", "no", "yeah", "yep", "hello", "hi", "hey",
        "how", "what", "why", "when", "where", "who", "which", "can", "could", "will",
        "would", "should", "please", "thanks", "thank", "you", "sure", "fine", "good",
        "morning", "afternoon", "evening", "night", "details", "call", "agent", "service",
        "account", "card", "plan", "recharge", "appointment", "doctor", "support", "help"
    }
    tokens = set(re.findall(r"\b[a-zA-Z]+\b", lower_text))
    if tokens and tokens.issubset(english_words):
        return SUPPORTED_LANGUAGES["en"]

    for marker in marathi_markers:
        if re.search(rf"(?<!\w){re.escape(marker)}(?!\w)", lower_text):
            return SUPPORTED_LANGUAGES["mr"]

    for marker in hindi_markers:
        if re.search(rf"(?<!\w){re.escape(marker)}(?!\w)", lower_text):
            return SUPPORTED_LANGUAGES["hi"]

    # Check Devanagari script presence
    if any("\u0900" <= char <= "\u097f" for char in text):
        return SUPPORTED_LANGUAGES["hi"]

    return SUPPORTED_LANGUAGES["en"]


# Re-exports for convenience
from agent.language_validator import LanguageValidator, ValidationResult  # noqa: E402
from agent.locales import LocaleManager, get_locale_manager  # noqa: E402


