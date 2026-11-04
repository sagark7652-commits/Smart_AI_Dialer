"""Update server.py with 0 delays for instant greeting."""
from pathlib import Path

p = Path("server.py")
text = p.read_text(encoding="utf-8")

old_code = """        custom_cfg["max_call_duration_sec"] = 3600.0
        custom_cfg["max_call_cost_usd"] = 9999.0"""

new_code = """        custom_cfg["max_call_duration_sec"] = 3600.0
        custom_cfg["max_call_cost_usd"] = 9999.0
        custom_cfg["pickup_wait_ms"] = 0
        custom_cfg["greeting_delay_ms"] = 0"""

text_norm = text.replace("\r\n", "\n")
old_norm = old_code.replace("\r\n", "\n")
new_norm = new_code.replace("\r\n", "\n")

assert old_norm in text_norm
text_norm = text_norm.replace(old_norm, new_norm, 1)

p.write_text(text_norm.replace("\n", "\r\n"), encoding="utf-8")
print("server.py updated with 0 pickup & greeting delay!")
