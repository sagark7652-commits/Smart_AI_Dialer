import re

with open("agent/pipeline.py", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'''(def _is_echo\(self, user_text: str\) -> bool:.*?u_clean = re\.sub\(r"\[\^\\w\\s\]", "", user_text\.lower\(\)\)\.strip\(\)\s+)(if len\(u_clean\) < 4:\s+return False\s+for recent_agent in reversed\(self\._recent_agent_replies\[-3:\]\):\s+a_clean = re\.sub\(r"\[\^\\w\\s\]", "", recent_agent\.lower\(\)\)\.strip\(\)\s+if not a_clean:\s+continue\s+# Direct containment\s+if u_clean in a_clean:\s+logger\.warning\([^\n]+\)\s+return True\s+# Fuzzy sequence similarity \(>65%\)\s+ratio = difflib\.SequenceMatcher\(None, u_clean, a_clean\)\.ratio\(\)\s+if ratio > 0\.65:\s+logger\.warning\([^\n]+\)\s+return True\s+return False)'''

replacement = r'''\1# Conversational turns (< 25 chars) like "namaste", "haan boliye", "theek hai" must never be dropped as echo
        if len(u_clean) < 25:
            return False

        for recent_agent in reversed(self._recent_agent_replies[-3:]):
            a_clean = re.sub(r"[^\w\s]", "", recent_agent.lower()).strip()
            if not a_clean or len(a_clean) < 20:
                continue

            # Only flag as echo if a long sentence matches over 75% of recent agent speech
            if u_clean in a_clean and (len(u_clean) / len(a_clean)) > 0.75:
                logger.warning(f"[ECHO GUARD] Dropped transcript matching substantial agent speech: '{user_text}'")
                return True

            ratio = difflib.SequenceMatcher(None, u_clean, a_clean).ratio()
            if ratio > 0.85:
                logger.warning(f"[ECHO GUARD] Dropped transcript (similarity {ratio:.2f}): '{user_text}'")
                return True

        return False'''

new_content, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
if count == 1:
    with open("agent/pipeline.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully patched _is_echo in agent/pipeline.py")
else:
    print(f"Failed to match _is_echo pattern, count={count}")
