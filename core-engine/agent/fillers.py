"""Natural conversational fillers and thinking phrases per language."""

import random
from typing import Dict, List, Optional


FILLER_PHRASES: Dict[str, Dict[str, List[str]]] = {
    "hi": {
        "thinking": [
            "हाँ जी, एक सेकंड...",
            "जी, मैं देख रही हूँ...",
            "अच्छा, एक पल रुकिए...",
            "जी, बिल्कुल...",
        ],
        "tool": [
            "एक सेकंड, सिस्टम में चेक कर रही हूँ...",
            "जी, मैं आपकी जानकारी चेक कर रही हूँ...",
            "एक पल रुकिए, मैं स्लॉट देख रही हूँ...",
        ],
        "acknowledgement": [
            "जी समझ गई...",
            "हाँ जी...",
            "बिल्कुल...",
        ],
    },
    "en": {
        "thinking": [
            "Sure, one moment...",
            "Let me check that for you...",
            "Right, give me just a second...",
            "Yes, checking that now...",
        ],
        "tool": [
            "One second, let me check our system...",
            "Checking the schedule for you now...",
            "Just a moment while I pull up those details...",
        ],
        "acknowledgement": [
            "Got it...",
            "Understood...",
            "Sure thing...",
        ],
    },
    "mr": {
        "thinking": [
            "हो, एक मिनिट...",
            "मी लगेच पाहते...",
            "नक्कीच, थोडा वेळ द्या...",
        ],
        "tool": [
            "एक सेकंद, मी सिस्टममध्ये तपासते...",
            "मी माहिती तपासत आहे, एक मिनिट...",
        ],
        "acknowledgement": [
            "हो, समजले...",
            "नक्कीच...",
            "होय...",
        ],
    },
}


class FillerManager:
    """Manages natural spoken fillers to prevent dead silence during LLM latency or tool runs."""

    def __init__(self, default_language: str = "hi", delay_threshold_ms: int = 800) -> None:
        self.default_language = default_language
        self.delay_threshold_ms = delay_threshold_ms

    def get_filler(self, category: str = "thinking", language: Optional[str] = None) -> str:
        """Return a random conversational filler for the category and language."""
        lang = language or self.default_language
        # Normalize code (e.g. hi-IN -> hi)
        lang_key = lang.split("-")[0].lower()
        if lang_key not in FILLER_PHRASES:
            lang_key = "hi" if "hi" in lang_key else ("mr" if "mr" in lang_key else "en")

        category_dict = FILLER_PHRASES.get(lang_key, FILLER_PHRASES["en"])
        phrases = category_dict.get(category, category_dict.get("thinking", ["One moment..."]))
        return random.choice(phrases)
