"""Patch web/index.html to ensure server audio is played and browser speech is suppressed when server audio is active."""
from pathlib import Path

p = Path("web/index.html")
text = p.read_text(encoding="utf-8")

old_str = """      } else if (msg.type === "audio") {
        setUIState("SPEAKING");
        playServerAudioChunk(msg.data, msg.sample_rate || 24000);"""

new_str = """      } else if (msg.type === "audio") {
        setUIState("SPEAKING");
        serverAudioPlayedThisTurn = true;
        playServerAudioChunk(msg.data, msg.sample_rate || 24000);"""

text_norm = text.replace("\r\n", "\n")
old_str_norm = old_str.replace("\r\n", "\n")
new_str_norm = new_str.replace("\r\n", "\n")

assert old_str_norm in text_norm, "audio block not found in index.html"
text_norm = text_norm.replace(old_str_norm, new_str_norm, 1)

p.write_text(text_norm.replace("\n", "\r\n"), encoding="utf-8")
print("web/index.html patched with serverAudioPlayedThisTurn = true!")
