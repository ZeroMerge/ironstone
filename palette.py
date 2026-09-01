import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find the Color Palette Strip div
pattern = re.compile(r'({\s*/\*\s*Color Palette Strip\s*\*/\s*})\s*<div className="mt-8">.*?</div>\s*\)\}\s*</div>', re.DOTALL)

def replacer(match):
    original = match.group(0)
    # We strip the comment out to wrap it cleanly
    inner_div = original.replace('{/* Color Palette Strip */}\n          ', '')
    if "viewMode !==" in original:
        return original # already wrapped
    return "{/* Color Palette Strip */}\n          {viewMode !== 'zen' && (\n            " + inner_div.strip() + "\n          )}"

content = pattern.sub(replacer, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Wrapped color palette")
