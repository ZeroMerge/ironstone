import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the useEffect for keyboard navigation
old_effect = r"""  useEffect\(\(\) => \{
    function handleKeyDown\(e: KeyboardEvent\) \{
      if \(e\.key === 'Escape'\) \{
        if \(viewMode === 'zen'\) \{
          setViewMode\('focus'\);
        \} else \{
          setRightInspectorOpen\(false\);
        \}
      \}
    \}
    window\.addEventListener\('keydown', handleKeyDown\);
    return \(\) => window\.removeEventListener\('keydown', handleKeyDown\);
  \}, \[viewMode\]\);"""

new_effect = """  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (viewMode === 'zen') {
          setViewMode('focus');
        } else {
          setRightInspectorOpen(false);
        }
      }
      if (viewMode === 'zen') {
        const idx = pages.findIndex(p => p.id === activePageId);
        if (e.key === 'ArrowRight' && idx < pages.length - 1) setActivePageId(pages[idx+1].id);
        if (e.key === 'ArrowLeft' && idx > 0) setActivePageId(pages[idx-1].id);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, activePageId, pages]);"""

content = re.sub(old_effect, new_effect, content)


# 2. Add overviewJsx just above canvasJsx
overview_jsx = """
  const overviewJsx = (
    <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-surface-muted/30 h-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-ink">Project Overview</h2>
          <button onClick={addPage} className="btn-primary !py-2 !px-4">
            <Plus size={16} /> Add Page
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-12 pb-12">
          {pages.map((p, i) => (
            <div 
              key={p.id}
              className="flex flex-col gap-4 group"
            >
              <div 
                className="relative shadow-sm rounded-lg overflow-hidden border-[1.5px] border-surface-muted group-hover:border-accent transition-colors bg-white cursor-pointer"
                onClick={() => { setActivePageId(p.id); setViewMode('focus'); }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Check if it's a page drag
                  const draggedPageId = e.dataTransfer.getData('application/ironstone-page');
                  if (draggedPageId && draggedPageId !== p.id) {
                    const draggedIdx = pages.findIndex(pg => pg.id === draggedPageId);
                    const targetIdx = i;
                    const newPages = [...pages];
                    const [removed] = newPages.splice(draggedIdx, 1);
                    newPages.splice(targetIdx, 0, removed);
                    const updatedPages = newPages.map((pg, idx) => ({ ...pg, order: idx }));
                    setPages(updatedPages);
                    updatedPages.forEach(pg => persistPage(pg));
                    return;
                  }

                  // Check if it's a block cross-page drag
                  const draggedBlockData = e.dataTransfer.getData('application/ironstone-block');
                  if (draggedBlockData) {
                    try {
                      const { block, sourcePageId } = JSON.parse(draggedBlockData);
                      if (sourcePageId !== p.id) {
                        // Move block from sourcePage to this page (p)
                        const sourcePage = pages.find(pg => pg.id === sourcePageId);
                        if (sourcePage) {
                          const updatedSource = { ...sourcePage, blocks: sourcePage.blocks.filter(b => b.id !== block.id) };
                          const updatedTarget = { ...p, blocks: [...p.blocks, block] };
                          persistPage(updatedSource);
                          persistPage(updatedTarget);
                          setPages(prev => prev.map(pg => pg.id === sourcePage.id ? updatedSource : (pg.id === p.id ? updatedTarget : pg)));
                        }
                      }
                    } catch (err) {}
                  }
                }}
              >
                <GridSurface
                  orientation={project.orientation}
                  styles={project.styles}
                  className="w-full pointer-events-none"
                >
                  {p.blocks.map((b) => (
                    <div 
                      key={b.id} 
                      style={blockStyle(b, rows)}
                      className="pointer-events-auto cursor-grab active:cursor-grabbing hover:ring-[1.5px] hover:ring-accent"
                      draggable
                      onClick={(e) => e.stopPropagation()} // Prevent triggering the page zoom
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('application/ironstone-block', JSON.stringify({ block: b, sourcePageId: p.id }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <EditorBlockContent block={b} />
                    </div>
                  ))}
                </GridSurface>
                <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors pointer-events-none" />
              </div>
              <div className="flex items-center justify-between px-1">
                <div 
                  className="flex items-center gap-2 cursor-grab active:cursor-grabbing text-text-muted hover:text-ink font-semibold"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/ironstone-page', p.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <GripHorizontal size={16} />
                  <span>Page {i + 1}</span>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }} className="p-1.5 text-text-muted hover:text-ink hover:bg-surface-active rounded" title="Duplicate"><Copy size={14}/></button>
                  {pages.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removePage(p.id); }} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded" title="Delete"><Trash2 size={14}/></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const canvasJsx = ("""

content = content.replace('  const canvasJsx = (', overview_jsx)


# 3. Modify the return structure to hide layout in zen mode
old_return = r"""return \(\s*<div className="flex flex-col h-full min-h-screen bg-bg overflow-hidden relative">.*?{/\* Mobile Degradation Banner \*/}.*?<header.*?</header>\s*<div className="flex flex-1 overflow-hidden">\s*{/\* Left Pages Sidebar \(Fixed, Non-collapsible\) \*/}\s*<aside.*?</aside>\s*{/\* Center Canvas \*/}\s*<section.*?<div className="flex items-center justify-center h-full text-text-muted text-sm font-semibold">\s*Multi-page Overview coming in Phase 21\.\.\.\s*</div>\s*\)}\s*</section>\s*{/\* Right Inspector \(Collapsible\) \*/}\s*<aside.*?</aside>\s*</div>"""

new_return = """return (
    <div className="flex flex-col h-full min-h-screen bg-bg overflow-hidden relative">
      {/* Mobile Degradation Banner */}
      <div className="lg:hidden bg-accent text-white px-4 py-2 text-xs font-semibold text-center shrink-0 z-50">
        Best experienced on desktop / tablet screen.
      </div>

      {/* Top Contextual Header */}
      {viewMode !== 'zen' && (
        <header className="h-14 border-b-[1.5px] border-surface-muted bg-surface flex items-center px-4 md:px-6 justify-between shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-4 text-sm text-text-muted w-1/4">
            <Link to={`/projects/${id}`} className="inline-flex items-center gap-2 hover:text-ink transition-colors font-semibold">
              <ArrowLeft size={16} strokeWidth={2} />
              <span className="truncate">{project.name}</span>
            </Link>
          </div>
          
          {/* Dynamic Contextual Property Bar (Phase 22) */}
          <div className="flex-1 flex justify-center text-xs font-medium text-text-muted">
            {selectedId ? "Block Properties (Phase 22)" : "Document Canvas"}
          </div>
          
          <div className="flex items-center justify-end gap-2 w-1/4">
            <button onClick={() => setViewMode('zen')} className="p-2 text-text-muted hover:text-ink hover:bg-surface-active rounded transition" title="Zen Preview">
              <MonitorPlay size={16} strokeWidth={1.5} />
            </button>
            <Link to={`/projects/${id}/export`} className="btn-primary !py-1.5 !px-3 text-xs">
              Export
            </Link>
            <div className="w-px h-4 bg-surface-muted mx-1" />
            <button 
              onClick={() => setRightInspectorOpen(!rightInspectorOpen)} 
              className={`p-2 rounded transition ${rightInspectorOpen ? 'bg-surface-active text-ink' : 'text-text-muted hover:text-ink hover:bg-surface-active'}`} 
              title="Toggle Right Inspector"
            >
              <ArrowRightToLine size={16} strokeWidth={1.5} className={`transition-transform ${rightInspectorOpen ? 'rotate-0' : 'rotate-180'}`} />
            </button>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pages Sidebar (Fixed, Non-collapsible) */}
        {viewMode !== 'zen' && (
          <aside className="w-56 shrink-0 bg-surface-muted/60 flex flex-col border-r-[1.5px] border-surface-muted z-10 overflow-hidden">
            {pagesListJsx}
          </aside>
        )}

        {/* Center Canvas */}
        <section className={`flex-1 overflow-auto bg-bg relative flex flex-col ${viewMode === 'zen' ? 'items-center justify-center p-0' : ''}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {viewMode === 'overview' ? overviewJsx : canvasJsx}
          
          {viewMode === 'zen' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase backdrop-blur-md flex items-center gap-4 opacity-0 hover:opacity-100 transition-opacity">
              <span>← Prev</span>
              <span>Slide {pages.findIndex(p => p.id === activePageId) + 1} of {pages.length}</span>
              <span>Next →</span>
              <span className="ml-4 opacity-50">Press Esc to exit</span>
            </div>
          )}
        </section>

        {/* Right Inspector (Collapsible) */}
        {viewMode !== 'zen' && (
          <aside 
            className={`shrink-0 bg-surface flex flex-col border-l-[1.5px] border-surface-muted z-10 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${rightInspectorOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'}`}
          >
            <div className="w-72 shrink-0 h-full overflow-hidden flex flex-col">
              {rightSidebarJsx}
            </div>
          </aside>
        )}
      </div>"""

content = re.sub(old_return, new_return, content, flags=re.DOTALL)


# 4. In canvasJsx, disable resize handles and selection when viewMode === 'zen'
# We need to find the handles rendering inside canvasJsx
# Wait, canvasJsx maps over activePage.blocks, if viewMode is 'zen' we hide the selection rings and handles.

# Let's add a GripHorizontal import
content = content.replace("Layers,", "Layers, GripHorizontal,")

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated viewModes")
