import re

with open(r'C:\Users\abundant\.gemini\antigravity\brain\e52d2f3a-2b34-482b-8687-c31bf577d124\task.md', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("- `[x]` Build dynamic contextual switcher observing active canvas selection", "- `[ ]` Build dynamic contextual switcher observing active canvas selection")
content = content.replace("- `[x]` Implement Canvas/Document default bar state", "- `[ ]` Implement Canvas/Document default bar state")
content = content.replace("- `[x]` Implement Text Block property bar", "- `[ ]` Implement Text Block property bar")
content = content.replace("- `[x]` Implement Image Block property bar", "- `[ ]` Implement Image Block property bar")
content = content.replace("- `[x]` Implement Palette Block property bar", "- `[ ]` Implement Palette Block property bar")
content = content.replace("- `[x]` Build on-canvas floating micro-action pill", "- `[ ]` Build on-canvas floating micro-action pill")

with open(r'C:\Users\abundant\.gemini\antigravity\brain\e52d2f3a-2b34-482b-8687-c31bf577d124\task.md', 'w', encoding='utf-8') as f:
    f.write(content)
print("Marked undone")
