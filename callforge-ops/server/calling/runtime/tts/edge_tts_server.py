"""Edge TTS Neural Voice Generator for CallForge Smart AI Dialer
Generates 100% authentic, studio-grade neural human voices in English, Hindi, and Marathi with zero external API key requirements.
"""

import sys
import os
import re
import asyncio
import hashlib
from pathlib import Path
import edge_tts

# Ensure utf-8 stdio on Windows
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

VOICE_MAP = {
    "mr-IN": "mr-IN-AarohiNeural",
    "mr": "mr-IN-AarohiNeural",
    "hi-IN": "hi-IN-SwaraNeural",
    "hi": "hi-IN-SwaraNeural",
    "en-IN": "en-IN-NeerjaNeural",
    "en": "en-IN-NeerjaNeural",
}

CACHE_DIR = Path("D:/Integrated_updated_Smart_AI_Dialer/Smart_AI_Dialer/core-engine/locales/cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def clean_text_for_speech(text: str, language: str) -> str:
    """Sanitize text to sound completely natural when spoken aloud."""
    cleaned = text.strip()
    
    # Remove markdown bold/italics
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    
    # Clean currency symbols
    if language.startswith("en"):
        cleaned = re.sub(r"₹\s*([0-9,]+)", r"\1 rupees", cleaned)
    else:
        cleaned = re.sub(r"₹\s*([0-9,]+)", r"\1 रुपये", cleaned)
    
    # Strip emojis and special formatting characters
    cleaned = re.sub(r"[\U00010000-\U0010ffff]", "", cleaned)
    
    # Normalize multiple whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


async def synthesize(text: str, language: str) -> str:
    lang_key = "mr-IN" if language.startswith("mr") else ("hi-IN" if language.startswith("hi") else "en-IN")
    voice = VOICE_MAP.get(lang_key, "en-IN-NeerjaNeural")

    clean_text = clean_text_for_speech(text, lang_key)
    if not clean_text:
        return ""

    # Generate a hash for cache deduplication
    text_hash = hashlib.md5(f"{voice}_{clean_text}".encode("utf-8")).hexdigest()
    out_file = CACHE_DIR / f"edge_{lang_key[:2]}_{text_hash}.mp3"

    if out_file.exists() and out_file.stat().st_size > 500:
        return out_file.name

    communicate = edge_tts.Communicate(clean_text, voice)
    await communicate.save(str(out_file))
    return out_file.name


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python edge_tts_server.py <language> [<text> | --stdin]")
        sys.exit(1)

    lang_arg = sys.argv[1]
    
    if len(sys.argv) >= 3 and sys.argv[2] != "--stdin":
        text_arg = sys.argv[2]
    else:
        text_arg = sys.stdin.read()

    filename = asyncio.run(synthesize(text_arg, lang_arg))
    print(filename)
