import re
from pathlib import Path

path = Path("web/index.html")
text = path.read_text(encoding="utf-8")

# Replace voice selector block with locked voice status
target_pattern = re.compile(
    r'<div class="form-group">\s*<label for="voiceSelect">.*?</select>\s*<button type="button" class="btn-test-voice".*?</button>\s*</div>\s*</div>',
    re.DOTALL
)

replacement = """<div class="form-group">
        <label>🔒 Server Voice (Locked 1 Voice Per Language)</label>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:9px 12px; background:#0b1120; border:1px solid #1e293b; border-radius:8px; font-size:0.86rem;">
          <span style="color:#38bdf8; font-weight:600;">🔒 Marathi: Meera • Hindi: Leher • English: Maple</span>
          <span style="color:#10b981; font-size:0.78rem; text-transform:uppercase; font-weight:700;">Locked Pipeline</span>
        </div>
      </div>"""

match = target_pattern.search(text)
if match:
    text = text[:match.start()] + replacement + text[match.end():]
    print("Found and replaced voice selector block!")
else:
    print("Warning: regex pattern did not match voice selector block")

# Disable voiceSelect manipulation in js
text = text.replace("voiceSelect.disabled = true;", "/* voice locked */")
text = text.replace("voiceSelect.disabled = false;", "/* voice locked */")
text = text.replace("if (voiceSelect) return;", "return;")

path.write_text(text, encoding="utf-8")
print("web/index.html updated successfully!")
