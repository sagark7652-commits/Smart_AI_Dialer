import re

with open('agent/pipeline.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace _set_state
pattern_set_state = r'(def _set_state\(self,\s*new_state:\s*AgentState\)\s*->\s*None:\s*if self\.state != new_state:\s*old_state = self\.state\s*self\.state = new_state)'
def repl_set_state(m):
    return m.group(1) + '\n\n            if new_state == AgentState.SPEAKING:\n                self._speaking_start_time = time.time()'

new_text, count1 = re.subn(pattern_set_state, repl_set_state, text, count=1)
if count1:
    print("Successfully patched _set_state in agent/pipeline.py")
    text = new_text
else:
    print("Warning: regex for _set_state did not match")

# Replace trigger_barge_in
pattern_trigger = r'(def trigger_barge_in\(self,\s*speech_onset_time:\s*Optional\[float\]\s*=\s*None\)\s*->\s*None:\s*)(if self\.state in \(AgentState\.SPEAKING,\s*AgentState\.THINKING\):)'
def repl_trigger(m):
    return (
        m.group(1)
        + 'if self.state != AgentState.SPEAKING:\n            return\n'
        + '        speaking_dur = time.time() - getattr(self, "_speaking_start_time", 0.0)\n'
        + '        if speaking_dur < 0.8:\n'
        + '            logger.info(f"[BARGE-IN GUARD] Ignored early barge-in during initial {speaking_dur*1000:.0f}ms of speech onset.")\n'
        + '            return\n'
        + '        if getattr(self, "_in_greeting_grace_period", False):\n'
        + '            logger.info("[BARGE-IN GUARD] Ignored barge-in during greeting grace period.")\n'
        + '            return\n        '
        + m.group(2)
    )

new_text, count2 = re.subn(pattern_trigger, repl_trigger, text, count=1)
if count2:
    print("Successfully patched trigger_barge_in in agent/pipeline.py")
    text = new_text
else:
    print("Warning: regex for trigger_barge_in did not match")

with open('agent/pipeline.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("agent/pipeline.py patch finished.")
