import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove leftOpen button and conditions
# We want to remove:
# <button ...> ... </button>
# {leftOpen ? ( <> ... </> ) : ( ... )}
# We can just extract the inner content of `leftOpen ? ( <> ... </>)`

# Left Sidebar
content = re.sub(r'<button\s*onClick=\{\(\) => setLeftOpen\(!leftOpen\)\}.*?</button>', '', content, flags=re.DOTALL)
# It's easier to just match the whole `leftOpen ?` block
left_block_pattern = re.compile(r'\{leftOpen \? \(\s*<>\s*(.*?)\s*</>\s*\) : \(\s*<div className="hidden md:flex flex-col gap-3 w-full mt-8">.*?</button>\s*</div>\s*\)\}', re.DOTALL)
content = left_block_pattern.sub(r'\1', content)

# Right Sidebar
content = re.sub(r'<button\s*onClick=\{\(\) => setRightOpen\(!rightOpen\)\}.*?</button>', '', content, flags=re.DOTALL)
right_block_pattern = re.compile(r'\{rightOpen \? \(\s*<>\s*(.*?)\s*</>\s*\) : \(\s*<div className="hidden md:flex flex-col gap-4 w-full mt-8 items-center">.*?</button>\s*</div>\s*\)\}', re.DOTALL)
content = right_block_pattern.sub(r'\1', content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed conditional blocks")
