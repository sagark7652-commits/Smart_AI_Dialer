"""Localized prompt and message repository for Marathi, Hindi, and Indian English."""

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from agent.logger import setup_logger

logger = setup_logger("locales")

LOCALES_DIR = Path("locales")


class LocaleManager:
    """Manages localized static and template phrases across languages and operational modes."""

    def __init__(self, locales_dir: Path = LOCALES_DIR):
        self.locales_dir = locales_dir
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._load_all()

    def _load_all(self) -> None:
        if not self.locales_dir.exists():
            return
        for file in self.locales_dir.glob("*.yaml"):
            lang = file.stem.lower()
            try:
                with open(file, "r", encoding="utf-8") as f:
                    self._cache[lang] = yaml.safe_load(f) or {}
            except Exception as e:
                logger.error(f"Failed to load locale file {file}: {e}")

    def get_line(self, lang: str, key: str, default: str = "") -> str:
        short = (lang or "en").split("-")[0].lower()
        locale = self._cache.get(short) or self._cache.get("en", {})
        val = locale.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        # Fallback to English if not found
        en_locale = self._cache.get("en", {})
        val_en = en_locale.get(key)
        if isinstance(val_en, str) and val_en.strip():
            return val_en.strip()
        return default

    def get_mode_line(self, lang: str, mode: str, key: str, default: str = "") -> str:
        short = (lang or "en").split("-")[0].lower()
        locale = self._cache.get(short) or self._cache.get("en", {})
        modes = locale.get("modes", {})
        mode_data = modes.get(mode, {})
        val = mode_data.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        # Fallback to English mode
        en_locale = self._cache.get("en", {})
        en_mode_data = en_locale.get("modes", {}).get(mode, {})
        val_en = en_mode_data.get(key)
        if isinstance(val_en, str) and val_en.strip():
            return val_en.strip()
        return default


@lru_cache()
def get_locale_manager() -> LocaleManager:
    return LocaleManager()
