import re

with open("server.py", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'(\s+if custom_cfg:\s+)(if lang_name:\s+custom_cfg\["default_language"\] = lang_name\s+custom_cfg\["gender"\] = gender_name\s+if "greeting" in custom_cfg:\s+#[^\n]+\s+#[^\n]+\s+del custom_cfg\["greeting"\])'

replacement = r'''\1active_preset = preset_name or mode_name or "mobile_recharge_promo"
        custom_cfg["preset_key"] = active_preset
        custom_cfg["mode_name"] = active_preset
        if lang_name:
            custom_cfg["default_language"] = lang_name
        custom_cfg["gender"] = gender_name'''

new_content, count = re.subn(pattern, replacement, content, count=1)
if count == 1:
    with open("server.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully patched server.py")
else:
    print(f"Failed to match pattern, count={count}")
