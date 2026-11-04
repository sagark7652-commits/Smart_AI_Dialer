with open('agent/pipeline.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''        tool_schemas = self.tools.get_schemas(tools_conf)'''

replacement = '''        tool_schemas = self.tools.get_schemas(tools_conf) if tools_conf else None'''

assert target.replace('\r\n', '\n') in text.replace('\r\n', '\n'), 'target not found in pipeline.py'
text = text.replace('\r\n', '\n').replace(target.replace('\r\n', '\n'), replacement)

with open('agent/pipeline.py', 'w', encoding='utf-8') as f:
    f.write(text)
print('Successfully patched tool_schemas in pipeline.py!')
