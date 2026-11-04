"""Patch web/index.html to completely disable browser speech synthesis during cloud audio."""
from pathlib import Path
import re

p = Path("web/index.html")
text = p.read_text(encoding="utf-8")

# 1. Update enqueueBrowserSpeech
old_enqueue = """    function enqueueBrowserSpeech(text) {

      if (!window.speechSynthesis || !text.trim()) return;"""

new_enqueue = """    function enqueueBrowserSpeech(text) {
      if (useServerAudio) {
        if (window.speechSynthesis) {
          try { window.speechSynthesis.cancel(); } catch(e) {}
        }
        return;
      }
      if (!window.speechSynthesis || !text.trim()) return;"""

# 2. Update enqueueBrowserSpeechChunk
old_chunk = """    function enqueueBrowserSpeechChunk(text) {

      if (!window.speechSynthesis || !text.trim()) return;"""

new_chunk = """    function enqueueBrowserSpeechChunk(text) {
      if (useServerAudio) return;
      if (!window.speechSynthesis || !text.trim()) return;"""

# 3. Update transcript handler
old_trans = """        if (msg.role === "agent") {

          if (!useServerAudio || !serverAudioPlayedThisTurn) {

            enqueueBrowserSpeech(msg.text);

          }

          serverAudioPlayedThisTurn = false;

        }"""

new_trans = """        if (msg.role === "agent") {
          if (!useServerAudio) {
            enqueueBrowserSpeech(msg.text);
          }
          serverAudioPlayedThisTurn = false;
        }"""

text_norm = text.replace("\r\n", "\n")
old_enqueue_norm = old_enqueue.replace("\r\n", "\n")
new_enqueue_norm = new_enqueue.replace("\r\n", "\n")
old_chunk_norm = old_chunk.replace("\r\n", "\n")
new_chunk_norm = new_chunk.replace("\r\n", "\n")
old_trans_norm = old_trans.replace("\r\n", "\n")
new_trans_norm = new_trans.replace("\r\n", "\n")

if old_enqueue_norm in text_norm:
    text_norm = text_norm.replace(old_enqueue_norm, new_enqueue_norm, 1)
    print("enqueueBrowserSpeech patched")
else:
    print("old_enqueue not found")

if old_chunk_norm in text_norm:
    text_norm = text_norm.replace(old_chunk_norm, new_chunk_norm, 1)
    print("enqueueBrowserSpeechChunk patched")
else:
    print("old_chunk not found")

if old_trans_norm in text_norm:
    text_norm = text_norm.replace(old_trans_norm, new_trans_norm, 1)
    print("transcript handler patched")
else:
    print("old_trans not found")

p.write_text(text_norm.replace("\n", "\r\n"), encoding="utf-8")
print("web/index.html dual voice patch complete!")
