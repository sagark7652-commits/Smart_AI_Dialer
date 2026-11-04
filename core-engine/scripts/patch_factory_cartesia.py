"""Patch factory.py so Cartesia cloned voice is used across both English and Hindi."""
import re
from pathlib import Path

p = Path("agent/tts/factory.py")
text = p.read_text(encoding="utf-8")

old_en = """        if self.settings.elevenlabs_api_key:
            vid = getattr(self.settings, "elevenlabs_voice_id", None) or "cgSgspJ2msm6clMCkdW9"
            self.en_tts = ElevenLabsTTS(voice_id=vid)"""

new_en = """        if self.settings.cartesia_api_key and getattr(self.settings, "cartesia_voice_id", None):
            self.en_tts = CartesiaTTS(voice_id=self.settings.cartesia_voice_id)
        elif self.settings.elevenlabs_api_key:
            vid = getattr(self.settings, "elevenlabs_voice_id", None) or "cgSgspJ2msm6clMCkdW9"
            self.en_tts = ElevenLabsTTS(voice_id=vid)"""

old_hi = """        if self.settings.sarvam_api_key:

            self.hi_tts = SarvamTTS(speaker=self.hi_voice, gender=self.gender)

            self.mr_tts = SarvamTTS(speaker=self.mr_voice, gender=self.gender)

        elif self.settings.cartesia_api_key:

            self.hi_tts = CartesiaTTS()

            self.mr_tts = CartesiaTTS()"""

new_hi = """        if self.settings.cartesia_api_key and getattr(self.settings, "cartesia_voice_id", None):
            self.hi_tts = CartesiaTTS(voice_id=self.settings.cartesia_voice_id)
            self.mr_tts = CartesiaTTS(voice_id=self.settings.cartesia_voice_id)
        elif self.settings.sarvam_api_key:
            self.hi_tts = SarvamTTS(speaker=self.hi_voice, gender=self.gender)
            self.mr_tts = SarvamTTS(speaker=self.mr_voice, gender=self.gender)
        elif self.settings.cartesia_api_key:
            self.hi_tts = CartesiaTTS()
            self.mr_tts = CartesiaTTS()"""

text_norm = text.replace("\r\n", "\n")
old_en_norm = old_en.replace("\r\n", "\n")
new_en_norm = new_en.replace("\r\n", "\n")
old_hi_norm = old_hi.replace("\r\n", "\n")
new_hi_norm = new_hi.replace("\r\n", "\n")

if old_en_norm in text_norm:
    text_norm = text_norm.replace(old_en_norm, new_en_norm, 1)

if old_hi_norm in text_norm:
    text_norm = text_norm.replace(old_hi_norm, new_hi_norm, 1)

p.write_text(text_norm.replace("\n", "\r\n"), encoding="utf-8")
print("factory.py updated for Cartesia cloned voice!")
