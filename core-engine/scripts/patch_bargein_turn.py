with open('agent/pipeline.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'self.trigger_barge_in()' in line and 790 < i < 830:
        lines.insert(i-1, '        if getattr(self, "_in_greeting_grace_period", False):\n            self._in_greeting_grace_period = False\n            self._interrupted_turn = True\n        self._interrupted_turn = True\n')
        break

with open('agent/pipeline.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Successfully patched process_user_turn')
