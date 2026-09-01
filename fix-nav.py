import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_effect = """  const showZenMessage = (msg: string) => {
    setZenMessage(msg);
    setTimeout(() => setZenMessage(null), 2000);
  };

  const navigateZen = useCallback((direction: 'next' | 'prev') => {
    const idx = pages.findIndex(p => p.id === activePageId);
    if (direction === 'next') {
      if (idx < pages.length - 1) setActivePageId(pages[idx+1].id);
      else showZenMessage("End of presentation");
    } else {
      if (idx > 0) setActivePageId(pages[idx-1].id);
      else showZenMessage("Start of presentation");
    }
  }, [pages, activePageId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (viewMode === 'zen') {
          if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
          setViewMode('focus');
        } else {
          setRightInspectorOpen(false);
        }
      }
      if (viewMode === 'zen') {
        if (e.key === 'ArrowRight' || e.key === ' ') navigateZen('next');
        if (e.key === 'ArrowLeft') navigateZen('prev');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, navigateZen]);

  // Keyboard shortcut: Delete selected block"""

content = content.replace("  // Keyboard shortcut: Delete selected block", new_effect)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added navigateZen correctly")
