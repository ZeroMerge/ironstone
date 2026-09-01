import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update state to include zenMessage
state_pattern = r"const \[dragOverIndex, setDragOverIndex\] = useState<number \| null>\(null\);"
new_state = "const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);\n  const [zenMessage, setZenMessage] = useState<string | null>(null);"
content = re.sub(state_pattern, new_state, content)


# 2. Update duplicatePage
old_dup = r"const duplicatePage = useCallback\(async \(pageId: string\) => \{.*?setActivePageId\(newPage\.id\);\n  \}, \[pages\]\);"

new_dup = """const duplicatePage = useCallback(async (pageId: string) => {
    const pageIdx = pages.findIndex(p => p.id === pageId);
    if (pageIdx === -1) return;
    const pageToDup = pages[pageIdx];
    
    const newPage: ProjectPage = {
      ...pageToDup,
      id: uid(),
      blocks: pageToDup.blocks.map(b => ({ ...b, id: uid() }))
    };
    
    const newPages = [...pages];
    newPages.splice(pageIdx + 1, 0, newPage);
    const updatedPages = newPages.map((pg, idx) => ({ ...pg, order: idx }));
    
    setPages(updatedPages);
    updatedPages.forEach(pg => putPage(pg));
    setActivePageId(newPage.id);
  }, [pages]);"""

content = re.sub(old_dup, new_dup, content, flags=re.DOTALL)


# 3. Add navigateZen and update keyboard listener
old_effect = re.compile(r'  useEffect\(\(\) => \{\n    function handleKeyDown.*?\}, \[viewMode, activePageId, pages\]\);', re.DOTALL)

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
  }, [viewMode, navigateZen]);"""

content = old_effect.sub(new_effect, content)


# 4. Update Zen Mode Overlay to add click nav and messages
old_zen = re.compile(r'\{\/\* True Fullscreen Zen \/ Presentation Overlay \*\/\}\s*\{viewMode === \'zen\' && \(\s*<div className="fixed inset-0 z-\[99999\] bg-\[#0F0F0F\] flex flex-col items-center justify-center overflow-hidden">.*?</div>\s*\)\}', re.DOTALL)

new_zen = """{/* True Fullscreen Zen / Presentation Overlay */}
      {viewMode === 'zen' && (
        <div 
          className="fixed inset-0 z-[99999] bg-[#0F0F0F] flex flex-col items-center justify-center overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX < rect.width / 2) navigateZen('prev');
            else navigateZen('next');
          }}
        >
          {zenMessage && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white/10 text-white backdrop-blur-md px-6 py-2 rounded-full text-sm font-bold z-50 animate-in fade-in slide-in-from-top-4 duration-300">
              {zenMessage}
            </div>
          )}
          <div 
            className="w-[90vw] h-[90vh] bg-white flex items-center justify-center shadow-2xl transition-all duration-300 ease-out"
            style={{ aspectRatio: project.orientation === 'landscape' ? '48/32' : '48/64' }}
          >
            <GridSurface
              orientation={project.orientation}
              styles={project.styles}
              className="w-full h-full"
              showGridOverlay={false}
            >
              {activePage?.blocks.map((b) => (
                <div key={b.id} style={blockStyle(b, rows)} className="pointer-events-none">
                  <EditorBlockContent block={b} />
                </div>
              ))}
            </GridSurface>
          </div>
          
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[11px] font-bold tracking-widest uppercase flex items-center gap-8">
            <span className="hover:text-white transition-colors">← Prev</span>
            <span className="text-white/90">Slide {pages.findIndex(p => p.id === activePageId) + 1} of {pages.length}</span>
            <span className="hover:text-white transition-colors">Next →</span>
          </div>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
              setViewMode('focus');
            }}
            className="absolute top-6 right-6 text-white/50 hover:text-white p-2 transition-colors z-50"
          >
            <span className="text-xs uppercase tracking-wider font-bold">Esc to Exit</span>
          </button>
        </div>
      )}"""

content = old_zen.sub(new_zen, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated zen and duplicate")
