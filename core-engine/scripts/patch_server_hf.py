"""Patch server.py to add Hugging Face status info."""
from pathlib import Path

p = Path("server.py")
text = p.read_text(encoding="utf-8")

old_str = '''    has_cloud_tts = bool(settings.cartesia_api_key or settings.sarvam_api_key or settings.openai_api_key or settings.elevenlabs_api_key)
    has_keys = bool(settings.groq_api_key and has_cloud_tts)
    await browser_provider.send_status_info({
        "mode": "cloud_ai" if has_keys else "browser_demo",
        "has_groq": bool(settings.groq_api_key),
        "has_deepgram": bool(settings.deepgram_api_key),
        "has_cartesia": bool(settings.cartesia_api_key),
        "has_sarvam": bool(settings.sarvam_api_key),
        "has_openai": bool(settings.openai_api_key),
        "has_elevenlabs": bool(settings.elevenlabs_api_key),
    })'''

new_str = '''    has_cloud_tts = bool(settings.cartesia_api_key or settings.sarvam_api_key or settings.openai_api_key or settings.elevenlabs_api_key or getattr(settings, "huggingface_api_key", None))
    has_keys = bool((settings.groq_api_key or getattr(settings, "huggingface_api_key", None)) and has_cloud_tts)
    await browser_provider.send_status_info({
        "mode": "cloud_ai" if has_keys else "browser_demo",
        "has_groq": bool(settings.groq_api_key),
        "has_deepgram": bool(settings.deepgram_api_key),
        "has_cartesia": bool(settings.cartesia_api_key),
        "has_sarvam": bool(settings.sarvam_api_key),
        "has_openai": bool(settings.openai_api_key),
        "has_elevenlabs": bool(settings.elevenlabs_api_key),
        "has_huggingface": bool(getattr(settings, "huggingface_api_key", None)),
    })'''

if old_str in text:
    text = text.replace(old_str, new_str, 1)
    p.write_text(text, encoding="utf-8")
    print("server.py updated with has_huggingface")
else:
    # Try normalized newlines
    normalized_old = old_str.replace("\r\n", "\n")
    normalized_text = text.replace("\r\n", "\n")
    if normalized_old in normalized_text:
        normalized_text = normalized_text.replace(normalized_old, new_str.replace("\r\n", "\n"), 1)
        p.write_text(normalized_text, encoding="utf-8")
        print("server.py updated with has_huggingface (normalized)")
    else:
        print("Pattern not found in server.py")
