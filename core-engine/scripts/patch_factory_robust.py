"""Patch factory.py robustly."""
import re
from pathlib import Path

p = Path("agent/tts/factory.py")
text = p.read_text(encoding="utf-8")

# 1. Update LanguageAdaptiveTTS.__init__
pattern_adaptive = re.compile(
    r"if self\.settings\.elevenlabs_api_key and getattr\(self\.settings, \"elevenlabs_voice_id\", None\):.*?"
    r"else:\s+self\.en_tts = MockTTS\(gender=self\.gender\)",
    re.DOTALL
)
new_adaptive = """if self.settings.elevenlabs_api_key:
            vid = getattr(self.settings, "elevenlabs_voice_id", None) or "cgSgspJ2msm6clMCkdW9"
            self.en_tts = ElevenLabsTTS(voice_id=vid)
        elif self.settings.openai_api_key:
            self.en_tts = OpenAITTS(voice=self.en_voice, gender=self.gender)
        else:
            self.en_tts = MockTTS(gender=self.gender)"""

text = pattern_adaptive.sub(new_adaptive, text, count=1)

# 2. Update get_tts_provider body
pattern_get_tts = re.compile(
    r"if provider == \"openai\":.*?"
    r"return LanguageAdaptiveTTS\(gender=gender, default_lang=lang\)",
    re.DOTALL
)
new_get_tts = """if provider == "elevenlabs" and settings.elevenlabs_api_key:
        return ElevenLabsTTS(voice_id=voice or getattr(settings, "elevenlabs_voice_id", None) or "cgSgspJ2msm6clMCkdW9")
    elif provider == "openai" and settings.openai_api_key:
        return OpenAITTS(voice=voice, gender=gender)
    elif provider == "sarvam" and settings.sarvam_api_key:
        return SarvamTTS(speaker=voice, gender=gender)
    elif provider == "cartesia" and settings.cartesia_api_key:
        return CartesiaTTS()
    elif provider in ("huggingface", "hf") and getattr(settings, "huggingface_api_key", None):
        from agent.tts.huggingface_tts import HuggingFaceTTS
        return HuggingFaceTTS(language=lang)
    else:
        # Adaptive multi-language routing by default
        return LanguageAdaptiveTTS(gender=gender, default_lang=lang)"""

text = pattern_get_tts.sub(new_get_tts, text, count=1)

p.write_text(text, encoding="utf-8")
print("factory.py patched cleanly with regex!")
