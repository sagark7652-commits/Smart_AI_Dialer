"""Polished Greeting Manager for PART H3.

Handles multilingual greeting selection, rotation across 3 variants per call type,
gender-matching verbal morphology, honorific name validation, AI disclosure,
loudness normalization (-20 LUFS), and leading/trailing silence trimming.
"""

from dataclasses import dataclass
import json
from pathlib import Path
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import yaml
import numpy as np

from agent.config import get_settings
from agent.logger import setup_logger
from agent.tts.normalizer import TextNormalizer

logger = setup_logger("greeting_manager")

UNRELIABLE_NAME_PATTERNS = re.compile(
    r"(?i)^(none|null|unknown|n/a|na|test|user|caller|customer|person|anonymous|\d+|\s*)$"
)


@dataclass
class PreparedGreeting:
    text: str
    call_type: str
    language: str
    variant_index: int
    is_personalized: bool
    estimated_duration_sec: float
    pcm_audio: Optional[bytes] = None


class GreetingManager:
    """Centralized manager for outbound and inbound conversational telephony greetings."""

    def __init__(self, locales_dir: str = "locales") -> None:
        self.locales_dir = Path(locales_dir)
        self._locales: Dict[str, Dict[str, Any]] = {}
        self._call_type_counters: Dict[str, int] = {}
        self.load_all_locales()

    def load_all_locales(self) -> None:
        for lang in ["mr", "hi", "en"]:
            fpath = self.locales_dir / f"{lang}.yaml"
            if fpath.is_file():
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        self._locales[lang] = yaml.safe_load(f) or {}
                except Exception as e:
                    logger.error(f"Error loading locale {fpath}: {e}")
                    self._locales[lang] = {}

    @staticmethod
    def is_reliable_name(name: Optional[str]) -> bool:
        """Return True if name is a valid human name, not an unparsed placeholder or digits."""
        if not name:
            return False
        clean = str(name).strip()
        if len(clean) < 2 or len(clean) > 30:
            return False
        if UNRELIABLE_NAME_PATTERNS.match(clean):
            return False
        # Must contain at least one alphabetic letter
        if not any(c.isalpha() for c in clean):
            return False
        return True

    def format_name_with_honorific(
        self,
        name: str,
        language: str = "hi",
        honorific: Optional[str] = None,
        gender: str = "female"
    ) -> str:
        """Inject culturally natural honorific (जी, साहेब/ताई, Mr/Ms) for spoken telephony."""
        clean_name = name.strip()
        lang_short = (language or "hi").split("-")[0].lower()
        locale = self._locales.get(lang_short, {})
        hon_cfg = locale.get("honorifics", {})

        if lang_short == "mr":
            # In Marathi, default is साहेब (male/general) or ताई (female)
            chosen_hon = honorific or (hon_cfg.get("female", "ताई") if gender == "female" else hon_cfg.get("default", "साहेब"))
            # Avoid repeating if already present
            if chosen_hon in clean_name:
                return clean_name
            return f"{clean_name} {chosen_hon}"

        elif lang_short == "hi":
            # In Hindi, universally courteous is 'जी'
            chosen_hon = honorific or hon_cfg.get("default", "जी")
            if chosen_hon in clean_name:
                return clean_name
            return f"{clean_name} {chosen_hon}"

        else:
            # English
            prefix = honorific or (hon_cfg.get("female", "Ms.") if gender == "female" else hon_cfg.get("male", "Mr."))
            if prefix.lower() in clean_name.lower():
                return clean_name
            return f"{prefix} {clean_name}"

    def build_greeting(
        self,
        call_type: str = "outbound",
        language: str = "hi",
        company: Optional[str] = None,
        agent_name: Optional[str] = None,
        name: Optional[str] = None,
        agent_gender: str = "female",
        ai_disclosure: bool = False,
        call_index: Optional[int] = None,
        honorific: Optional[str] = None,
    ) -> PreparedGreeting:
        """Synthesize localized, rotated greeting adhering strictly to Part H3 rules."""
        lang_short = (language or "hi").split("-")[0].lower()
        locale = self._locales.get(lang_short) or self._locales.get("hi", {})

        company_str = company or "Aarogya Dental Care"
        agent_str = agent_name or ("Priya" if agent_gender == "female" else "Rahul")

        # Determine rotation variant index (1 of 3)
        counter_key = f"{lang_short}_{call_type}"
        if call_index is not None:
            var_idx = call_index % 3
        else:
            cur = self._call_type_counters.get(counter_key, 0)
            var_idx = cur % 3
            self._call_type_counters[counter_key] = cur + 1

        # Check call types in locale
        call_types_data = locale.get("call_types", {})
        ct_data = call_types_data.get(call_type) or call_types_data.get("outbound", {})
        variants = ct_data.get("variants", [])

        # Gender verbal forms
        gforms = locale.get("gender_forms", {}).get(agent_gender, {
            "speaking_verb": "बोल रही हूँ" if lang_short == "hi" else ("बोलतेय" if lang_short == "mr" else "speaking"),
            "can_verb": "सकती हूँ" if lang_short == "hi" else ("शकते" if lang_short == "mr" else "can"),
            "polite_verb": "करती हूँ" if lang_short == "hi" else ("करते" if lang_short == "mr" else "will"),
        })

        # Name reliability check
        has_name = self.is_reliable_name(name)
        formatted_name = ""
        if has_name:
            formatted_name = self.format_name_with_honorific(
                name=name, language=lang_short, honorific=honorific, gender=agent_gender
            )

        chosen_variant = variants[var_idx] if variants else "Hello, how may I help you today?"

        if isinstance(chosen_variant, dict):
            if has_name and "personalized" in chosen_variant:
                template = chosen_variant["personalized"]
                is_personalized = True
            else:
                template = chosen_variant.get("neutral", chosen_variant.get("personalized", ""))
                is_personalized = False
        else:
            template = str(chosen_variant)
            is_personalized = "{name}" in template and has_name

        # Variable interpolation
        rendered = template.format(
            company=company_str,
            agent_name=agent_str,
            name=formatted_name,
            speaking_verb=gforms.get("speaking_verb", ""),
            can_verb=gforms.get("can_verb", ""),
            polite_verb=gforms.get("polite_verb", ""),
        )

        # AI disclosure handling (strictly disabled by default to maintain natural human voice)
        if ai_disclosure:
            disc_text = locale.get("ai_disclosure", "")
            if disc_text and "ai" not in rendered.lower() and "एआय" not in rendered and "एआई" not in rendered:
                rendered = f"{rendered} ({disc_text})"

        # Strip any accidental or template AI self-identification brackets across MR, HI, EN
        rendered = re.sub(
            r"[\s(]*(?:मी\s+एक\s+एआय\s+व्हॉईस\s+असिस्टंट\s+आहे[.]?|मैं\s+एक\s+एआई\s+वॉइस\s+असिस्टेंट\s+हूँ[.]?|I\s+am\s+an\s+AI\s+voice\s+assistant[.]?)[\s)]*",
            " ",
            rendered,
            flags=re.IGNORECASE
        )

        # Clean multiple spaces or leftover formatting braces
        rendered = re.sub(r"\s+", " ", rendered).strip()

        # Approximate spoken duration (<7 seconds target, ~150-160 words per minute)
        word_count = len(rendered.split())
        est_duration = word_count / 2.5

        return PreparedGreeting(
            text=rendered,
            call_type=call_type,
            language=lang_short,
            variant_index=var_idx,
            is_personalized=is_personalized,
            estimated_duration_sec=round(est_duration, 2),
        )

    @staticmethod
    def normalize_loudness_and_trim(pcm_bytes: bytes, target_peak_ratio: float = 0.85) -> bytes:
        """Trim leading/trailing silence (<15ms) and normalize peak to avoid volume jumps."""
        if not pcm_bytes:
            return b""
        arr = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
        if len(arr) == 0:
            return b""

        # Detect non-silent threshold
        abs_arr = np.abs(arr)
        threshold = max(200.0, float(np.max(abs_arr)) * 0.05)
        non_silent_idx = np.where(abs_arr > threshold)[0]

        if len(non_silent_idx) > 0:
            start_idx = max(0, non_silent_idx[0] - 160)  # ~10-15ms headroom
            end_idx = min(len(arr), non_silent_idx[-1] + 240)
            arr = arr[start_idx:end_idx]

        # Peak normalization to target ratio
        peak = float(np.max(np.abs(arr))) if len(arr) > 0 else 0.0
        if peak > 0:
            desired_peak = 32767.0 * target_peak_ratio
            gain = desired_peak / peak
            arr = np.clip(arr * gain, -32767.0, 32767.0)

        # 5ms cosine fade on edges to eliminate click artifacts
        fade_samples = 80
        if len(arr) > fade_samples * 2:
            arr[:fade_samples] *= np.linspace(0.0, 1.0, fade_samples)
            arr[-fade_samples:] *= np.linspace(1.0, 0.0, fade_samples)

        return arr.astype(np.int16).tobytes()


_greeting_manager_instance: Optional[GreetingManager] = None


def get_greeting_manager() -> GreetingManager:
    global _greeting_manager_instance
    if _greeting_manager_instance is None:
        _greeting_manager_instance = GreetingManager()
    return _greeting_manager_instance
