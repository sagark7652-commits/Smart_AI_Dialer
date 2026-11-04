"""Patch cartesia_tts.py to slice audio stream into low-latency frames."""
from pathlib import Path

p = Path("agent/tts/cartesia_tts.py")
text = p.read_text(encoding="utf-8")

old_code = """            async for chunk in audio_stream:
                if chunk:
                    yield chunk"""

new_code = """            async for chunk in audio_stream:
                if chunk:
                    frame_size = 2048
                    for i in range(0, len(chunk), frame_size):
                        yield chunk[i : i + frame_size]"""

text_norm = text.replace("\r\n", "\n")
old_code_norm = old_code.replace("\r\n", "\n")
new_code_norm = new_code.replace("\r\n", "\n")

assert old_code_norm in text_norm
text_norm = text_norm.replace(old_code_norm, new_code_norm, 1)

p.write_text(text_norm.replace("\n", "\r\n"), encoding="utf-8")
print("cartesia_tts.py updated with streaming frame slicing!")
