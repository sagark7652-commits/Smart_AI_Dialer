"""Pronunciation Dictionary: Normalizes domain-specific terms, clinic names, and abbreviations for TTS."""

import json
from pathlib import Path
import re
from typing import Dict, Optional
from agent.logger import setup_logger

logger = setup_logger("pronunciation")

# Default pronunciation dictionary for clinical and conversational telephony
DEFAULT_PRONUNCIATION_RULES: Dict[str, Dict[str, str]] = {
    "hi": {
        r"\bDr\.\b": "डॉक्टर",
        r"\bDr\b": "डॉक्टर",
        r"\bOPD\b": "ओपीडी",
        r"\bRCT\b": "रूट कैनाल ट्रीटमेंट",
        r"\bAI\b": "एआई",
        r"\bAarogya\b": "आरोग्य",
        r"\bClinic\b": "क्लीनिक",
        r"\bDental\b": "डेंटल",
        r"\bCare\b": "केयर",
        r"\bmg\b": "मिलीग्राम",
        r"\bml\b": "मिलीलीटर",
        r"\bappt\b": "अपॉइंटमेंट",
    },
    "mr": {
        r"\bDr\.\b": "डॉक्टर",
        r"\bDr\b": "डॉक्टर",
        r"\bOPD\b": "ओपीडी",
        r"\bRCT\b": "रूट कॅनाल ट्रीटमेंट",
        r"\bAI\b": "एआय",
        r"\bAarogya\b": "आरोग्य",
        r"\bClinic\b": "क्लिनिक",
        r"\bmg\b": "मिलीग्रॅम",
        r"\bml\b": "मिलीलीटर",
    },
    "en": {
        r"\bDr\.\b": "Doctor",
        r"\bOPD\b": "O.P.D.",
        r"\bRCT\b": "Root Canal Treatment",
        r"\bAI\b": "A.I.",
        r"\bAarogya\b": "Ah-rogya",
        r"\bmg\b": "milligrams",
        r"\bml\b": "milliliters",
        r"\bappt\b": "appointment",
    },
}


class PronunciationManager:
    """Manages phonetic replacements before TTS synthesis."""

    def __init__(self, dictionary_path: Optional[str] = "pronunciation.json") -> None:
        self.rules: Dict[str, Dict[str, str]] = dict(DEFAULT_PRONUNCIATION_RULES)
        if dictionary_path and Path(dictionary_path).exists():
            self.load_from_file(dictionary_path)

    def load_from_file(self, filepath: str) -> None:
        """Load external JSON pronunciation mappings."""
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                custom_rules = json.load(f)
                for lang, mapping in custom_rules.items():
                    if lang not in self.rules:
                        self.rules[lang] = {}
                    self.rules[lang].update(mapping)
            logger.info(f"Loaded custom pronunciation rules from {filepath}")
        except Exception as e:
            logger.warning(f"Could not load custom pronunciation dictionary from {filepath}: {e}")

    def apply(self, text: str, language: str = "hi") -> str:
        """Replace domain terms and abbreviations with phonetic equivalents."""
        if not text:
            return text

        lang_key = language.split("-")[0].lower()
        active_rules = self.rules.get(lang_key, self.rules.get("en", {}))

        processed = text
        for pattern, replacement in active_rules.items():
            # If pattern is a plain word without boundary tokens, wrap with word boundaries
            if not pattern.startswith(r"\b") and not pattern.startswith("^"):
                regex_pat = rf"\b{re.escape(pattern)}\b"
            else:
                regex_pat = pattern

            # For uppercase abbreviations (like AI), preserve case-sensitivity
            flags = 0 if (pattern == "AI" or pattern == r"\bAI\b") else re.IGNORECASE
            processed = re.sub(regex_pat, replacement, processed, flags=flags)

        return processed


_pronunciation_manager: Optional[PronunciationManager] = None


def get_pronunciation_manager() -> PronunciationManager:
    """Return singleton PronunciationManager instance."""
    global _pronunciation_manager
    if _pronunciation_manager is None:
        _pronunciation_manager = PronunciationManager()
    return _pronunciation_manager
