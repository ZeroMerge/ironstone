import re

with open(r'C:\Users\abundant\.gemini\antigravity\brain\e52d2f3a-2b34-482b-8687-c31bf577d124\task.md', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("- `[ ]`", "- `[x]`")

with open(r'C:\Users\abundant\.gemini\antigravity\brain\e52d2f3a-2b34-482b-8687-c31bf577d124\task.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("Marked done")
