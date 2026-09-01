import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove StudioStyleBar
bar_pattern = re.compile(r'\{/\* Studio Style Bar \*/\}.*?<StudioStyleBar.*?\n\s*/>', re.DOTALL)
content = bar_pattern.sub('', content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed StudioStyleBar")
