import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

effect = """  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (viewMode === 'zen') {
          setViewMode('focus');
        } else {
          setRightInspectorOpen(false);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  // Sync title changes debounced (we'll implement the actual renaming in Phase 26 or inline)"""

content = content.replace("  // Document event listeners for block deletion", effect + "\n\n  // Document event listeners for block deletion")

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added Esc shortcut")
