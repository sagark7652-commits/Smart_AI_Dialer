"""Mute browser speech on cloud audio event."""
from pathlib import Path

p = Path("web/index.html")
text = p.read_text(encoding="utf-8")
t = 'console.log("[Audio Engine] Server Cloud TTS enabled (OpenAI Sol / Sarvam / Cartesia).");'
r = 'if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch(e) {} }\n          console.log("[Audio Engine] Server Cloud TTS enabled (Cartesia Cloned Voice). Browser SpeechSynthesis MUTED.");'

if t in text:
    text = text.replace(t, r, 1)
    p.write_text(text, encoding="utf-8")
    print("handleServerEvent updated to silence browser speech!")
else:
    print("Pattern not found in web/index.html")
