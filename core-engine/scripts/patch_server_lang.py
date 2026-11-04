with open('server.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    pipeline.current_language = lang_name
    pipeline.language_locked = True'''

replacement = '''    pipeline.current_language = lang_name
    pipeline.language_locked = True
    if pipeline.session:
        pipeline.session.set_active_language(lang_name)
    if pipeline.tts and hasattr(pipeline.tts, "set_language"):
        pipeline.tts.set_language(lang_name)'''

assert target.replace('\r\n', '\n') in text.replace('\r\n', '\n'), 'target not found in server.py'
text = text.replace('\r\n', '\n').replace(target.replace('\r\n', '\n'), replacement)

with open('server.py', 'w', encoding='utf-8') as f:
    f.write(text)
print('Successfully patched server.py for session.set_active_language!')
