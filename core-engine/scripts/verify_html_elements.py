import re

with open('web/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

ids_used = re.findall(r'document\.getElementById\(["\']([^"\']+)["\']\)', text)
ids_in_html = set(re.findall(r'id=["\']([^"\']+)["\']', text))

missing = [i for i in ids_used if i not in ids_in_html]
print('Total getElementById calls:', len(ids_used))
print('Unique IDs queried:', len(set(ids_used)))
print('Missing IDs:', set(missing))
