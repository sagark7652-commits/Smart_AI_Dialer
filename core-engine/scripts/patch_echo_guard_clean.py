with open("agent/pipeline.py", "r", encoding="utf-8") as f:
    content = f.read()

target = """        if len(u_clean) < 4:

            return False



        for recent_agent in reversed(self._recent_agent_replies[-3:]):

            a_clean = re.sub(r"[^\w\s]", "", recent_agent.lower()).strip()

            if not a_clean:

                continue

            # Direct containment

            if u_clean in a_clean:

                logger.warning(f"[ECHO GUARD] Dropped transcript matching recent agent speech: '{user_text}'")

                return True

            # Fuzzy sequence similarity (>65%)

            ratio = difflib.SequenceMatcher(None, u_clean, a_clean).ratio()

            if ratio > 0.65:

                logger.warning(f"[ECHO GUARD] Dropped transcript (similarity {ratio:.2f}): '{user_text}'")

                return True

        return False"""

# Normalize newlines
def normalize(s):
    return "\n".join(line.rstrip() for line in s.splitlines())

replacement = """        # Conversational turns (< 25 chars) like "namaste", "haan boliye", "theek hai" must never be dropped as echo
        if len(u_clean) < 25:
            return False

        for recent_agent in reversed(self._recent_agent_replies[-3:]):
            a_clean = re.sub(r"[^\\w\\s]", "", recent_agent.lower()).strip()
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

        return False"""

norm_content = normalize(content)
norm_target = normalize(target)
norm_replacement = normalize(replacement)

if norm_target in norm_content:
    norm_content = norm_content.replace(norm_target, norm_replacement, 1)
    with open("agent/pipeline.py", "w", encoding="utf-8") as f:
        f.write(norm_content)
    print("Successfully replaced _is_echo in agent/pipeline.py")
else:
    print("Target not found in normalized content")
