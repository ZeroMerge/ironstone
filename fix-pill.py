import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pill_btn_pattern = re.compile(r'<button \n\s*onClick=\{.*?setViewMode.*?title="Grid Overview"\n\s*>\n\s*<Grid2X2 size=\{16\} />\n\s*<span.*?</span>\n\s*</button>\n\s*<div className="w-px h-6 bg-surface-muted mx-1" />', re.DOTALL)
content = pill_btn_pattern.sub('', content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed from pill")
