import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add scrollbar-hover to Left Pages
content = content.replace('className="flex-1 flex flex-col gap-3 overflow-y-auto px-2 pb-4"', 'className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hover px-2 pb-4"')

# Add scrollbar-hover to Right Inspector
content = content.replace('className="flex-1 overflow-y-auto px-4 pb-6"', 'className="flex-1 overflow-y-auto scrollbar-hover px-4 pb-6"')

# Add scrollbar-hover to Overview
content = content.replace('className="flex-1 overflow-y-auto p-8 bg-surface-muted/30 h-full"', 'className="flex-1 overflow-y-auto scrollbar-hover p-8 bg-surface-muted/30 h-full"')

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added scrollbar-hover")
