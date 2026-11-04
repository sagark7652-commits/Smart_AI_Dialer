"""Pre-generate and cache audio for localized fixed lines across Marathi, Hindi, and English.

Saves zero-latency audio into locales/cache/<lang>_<voice>_<key>.wav for instant playback.
"""

import asyncio
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from typing import Dict, List
import wave
import yaml
from agent.config import get_settings
from agent.logger import setup_logger
from agent.tts.factory import get_tts_provider
from agent.tts.mock_tts import MockTTS

logger = setup_logger("cache_fixed_lines")

CACHE_DIR = Path("locales/cache")
LOCALES_DIR = Path("locales")

FIXED_KEYS = [
    "greeting",
    "consent",
    "are_you_there",
    "silence_farewell",
    "goodbye",
    "not_interested",
    "transfer",
    "error_fallback",
    "callback_offer",
    "not_understood",
    "hold",
    "dnc_confirmed",
]


async def cache_all_fixed_lines() -> Dict[str, dict]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    settings = get_settings()

    # Determine TTS provider
    if settings.cartesia_api_key or settings.sarvam_api_key:
        tts = get_tts_provider()
        provider_name = tts.__class__.__name__
    else:
        logger.info("Cloud TTS API keys not configured in .env; utilizing MockTTS for audio cache compilation.")
        tts = MockTTS(sample_rate=24000)
        provider_name = "MockTTS"

    sample_rate = getattr(tts, "SAMPLE_RATE", 24000)
    summary_report: Dict[str, dict] = {}

    print("\n" + "=" * 70)
    print("      LOCALIZED FIXED-LINES ZERO-LATENCY AUDIO CACHE COMPILATION      ")
    print(f"      Engine: {provider_name} | Target SR: {sample_rate}Hz            ")
    print("=" * 70)

    for locale_file in LOCALES_DIR.glob("*.yaml"):
        lang = locale_file.stem.lower()
        try:
            with open(locale_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except Exception as e:
            logger.error(f"Failed to read {locale_file}: {e}")
            continue

        print(f"\n[*] Processing Language: [{lang.upper()}] ({locale_file.name})")

        # Determine voice label
        voice_label = "female"
        if lang == "mr":
            voice_label = "meera"
        elif lang == "hi":
            voice_label = "leher"
        else:
            voice_label = "maple"

        for key in FIXED_KEYS:
            text = data.get(key)
            if not text or not isinstance(text, str):
                continue

            cache_filename = f"{lang}_{voice_label}_{key}.wav"
            cache_path = CACHE_DIR / cache_filename

            t0 = time.perf_counter()
            pcm_bytes = bytearray()

            try:
                async for chunk in tts.generate_audio_stream(text.strip(), language=lang):
                    pcm_bytes.extend(chunk)
                gen_ms = (time.perf_counter() - t0) * 1000

                # Save WAV file
                with wave.open(str(cache_path), "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(sample_rate)
                    wf.writeframes(bytes(pcm_bytes))

                file_size_kb = cache_path.stat().st_size / 1024
                duration_sec = (len(pcm_bytes) / 2) / sample_rate

                summary_report[f"{lang}:{key}"] = {
                    "path": str(cache_path),
                    "gen_ms": round(gen_ms, 1),
                    "duration_sec": round(duration_sec, 2),
                    "file_size_kb": round(file_size_kb, 1),
                }

                print(f"    ✓ [{key:16s}] -> {cache_filename} ({duration_sec:.2f}s, {file_size_kb:.1f}KB, {gen_ms:.1f}ms)")
            except Exception as e:
                logger.error(f"Error caching {key} ({lang}): {e}")
                print(f"    ✗ [{key:16s}] FAILED: {e}")

    print("\n" + "=" * 70)
    print(f"CACHE COMPLETE: {len(summary_report)} fixed audio files written to '{CACHE_DIR.resolve()}'.")
    print("=" * 70 + "\n")
    return summary_report


if __name__ == "__main__":
    asyncio.run(cache_all_fixed_lines())
