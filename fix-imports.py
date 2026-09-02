import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("ArrowLeft } PanelLeft", "ArrowLeft, PanelLeft")

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed imports")
