with open('agent/pipeline.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the messy block
bad_block = '''        if self.state == AgentState.SPEAKING:
        if getattr(self, "_in_greeting_grace_period", False):
            self._in_greeting_grace_period = False
            self._interrupted_turn = True
        self._interrupted_turn = True

            self.trigger_barge_in()'''

clean_block = '''        if getattr(self, "_in_greeting_grace_period", False):
            self._in_greeting_grace_period = False
            self._interrupted_turn = True

        if self.state == AgentState.SPEAKING:
            self._interrupted_turn = True
            self.trigger_barge_in()'''

bad_block_norm = bad_block.replace('\r\n', '\n')
clean_block_norm = clean_block.replace('\r\n', '\n')
text_norm = text.replace('\r\n', '\n')

assert bad_block_norm in text_norm, 'bad_block not found!'
text_norm = text_norm.replace(bad_block_norm, clean_block_norm)

with open('agent/pipeline.py', 'w', encoding='utf-8') as f:
    f.write(text_norm)
print('Fixed indentation in agent/pipeline.py!')
