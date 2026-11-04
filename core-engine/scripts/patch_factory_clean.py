"""Update get_tts_provider to handle both explicit provider names and adaptive fallback."""
from pathlib import Path
import re

p = Path("agent/tts/factory.py")
text = p.read_text(encoding="utf-8")

pattern = re.compile(
    r"def get_tts_provider\(.*?return LanguageAdaptiveTTS\(gender=gender, default_lang=lang\)",
    re.DOTALL
)

new_code = '''def get_tts_provider(
    provider_name: Optional[str] = None,
    language: Optional[str] = None,
    gender: str = "female",
    voice: Optional[str] = None,
) -> BaseTTS:
    """Instantiate and return the configured TTS engine."""
    settings = get_settings()
    provider = (provider_name or settings.tts_provider).lower()
    lang = (language or "hi").lower()

    if provider == "openai":
        return OpenAITTS(voice=voice, gender=gender)
    elif provider == "sarvam":
        return SarvamTTS(speaker=voice, gender=gender)
    elif provider == "elevenlabs":
        return ElevenLabsTTS(voice_id=voice or getattr(settings, "elevenlabs_voice_id", None) or "cgSgspJ2msm6clMCkdW9")
    elif provider == "cartesia":
        return CartesiaTTS(voice_id=voice or getattr(settings, "cartesia_voice_id", None) or "a1e4199c-8c88-4608-8491-33da880e63b8")
    elif provider in ("huggingface", "hf"):
        from agent.tts.huggingface_tts import HuggingFaceTTS
        return HuggingFaceTTS(language=lang)
    else:
        # Adaptive multi-language routing by default
        return LanguageAdaptiveTTS(gender=gender, default_lang=lang)'''

text = pattern.sub(new_code, text, count=1)
p.write_text(text, encoding="utf-8")
print("get_tts_provider updated cleanly!")
