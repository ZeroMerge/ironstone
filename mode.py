import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add dragOverIndex state
state_pattern = r"const \[activeInspectorTab, setActiveInspectorTab\] = useState<'blocks' \| 'assets' \| 'styles' \| 'presets'>\('blocks'\);"
new_state = "const [activeInspectorTab, setActiveInspectorTab] = useState<'blocks' | 'assets' | 'styles' | 'presets'>('blocks');\n  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);"
content = re.sub(state_pattern, new_state, content)


# 2. Rewrite overviewJsx for Canva style and drag-drop indicators
old_overview = re.compile(r'const overviewJsx = \(\s*<div className="flex-1 overflow-y-auto p-8 md:p-12 bg-surface-muted/30 h-full">.*?</div>\n    </div>\n  \);', re.DOTALL)

new_overview = """const overviewJsx = (
    <div className="flex-1 overflow-y-auto p-8 bg-surface-muted/30 h-full">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 pb-12">
          {pages.map((p, i) => (
            <div 
              key={p.id}
              className="flex flex-col gap-2 relative group"
            >
              {/* Drop Indicator */}
              {dragOverIndex === i && (
                <div className="absolute -left-5 top-0 bottom-6 w-1 bg-accent rounded-full z-10" />
              )}
              {dragOverIndex === pages.length && i === pages.length - 1 && (
                <div className="absolute -right-5 top-0 bottom-6 w-1 bg-accent rounded-full z-10" />
              )}
              
              <div 
                className="relative shadow-sm rounded overflow-hidden border border-surface-muted group-hover:border-accent group-hover:shadow-md transition-all bg-white cursor-pointer"
                onClick={() => { setActivePageId(p.id); setViewMode('focus'); }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/ironstone-page', p.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  
                  // Calculate if we are hovering on left half or right half of the card
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  if (x < rect.width / 2) {
                    setDragOverIndex(i);
                  } else {
                    setDragOverIndex(i + 1);
                  }
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const targetIdx = dragOverIndex !== null ? dragOverIndex : i;
                  setDragOverIndex(null);
                  
                  const draggedPageId = e.dataTransfer.getData('application/ironstone-page');
                  if (draggedPageId && draggedPageId !== p.id) {
                    const draggedIdx = pages.findIndex(pg => pg.id === draggedPageId);
                    const newPages = [...pages];
                    const [removed] = newPages.splice(draggedIdx, 1);
                    // Adjust target index if we removed from earlier in the array
                    const adjustedTargetIdx = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
                    newPages.splice(adjustedTargetIdx, 0, removed);
                    
                    const updatedPages = newPages.map((pg, idx) => ({ ...pg, order: idx }));
                    setPages(updatedPages);
                    updatedPages.forEach(pg => persistPage(pg));
                    return;
                  }

                  const draggedBlockData = e.dataTransfer.getData('application/ironstone-block');
                  if (draggedBlockData) {
                    try {
                      const { block, sourcePageId } = JSON.parse(draggedBlockData);
                      if (sourcePageId !== p.id) {
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
                      onClick={(e) => e.stopPropagation()}
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
                
                {/* Hover actions inside the card like Canva */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-ink shadow-sm rounded border border-surface-muted/50" title="Duplicate"><Copy size={12}/></button>
                  {pages.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-danger shadow-sm rounded border border-surface-muted/50" title="Delete"><Trash2 size={12}/></button>
                  )}
                </div>
              </div>
              
              <div className="text-center">
                <span className="text-xs font-medium text-text-muted">{i + 1}</span>
              </div>
            </div>
          ))}
          
          {/* Add Page Button as a card */}
          <div 
            onClick={addPage}
            className="flex flex-col gap-2 relative group"
          >
            <div className="relative rounded overflow-hidden border border-transparent bg-surface-muted/50 hover:bg-surface-active transition-all cursor-pointer flex items-center justify-center text-text-muted hover:text-ink" style={{ aspectRatio: project.orientation === 'landscape' ? '48/32' : '48/64' }}>
               <Plus size={24} strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );"""

content = old_overview.sub(new_overview, content)


# 3. Modify Zen mode. Instead of hacking the layout, we keep the layout normal if NOT zen, and overlay Zen Mode over EVERYTHING.
# To do this, viewMode !== 'zen' should wrap the ENTIRE editor layout!
# And viewMode === 'zen' should render a true fullscreen presentation overlay.

old_return = re.compile(r'return \(\s*<div className="flex flex-col h-full min-h-screen bg-bg overflow-hidden relative">.*?{/\* Mobile Degradation Banner \*/}.*?</aside>\s*\)}\s*</div>.*?</div>\s*\);\s*\}', re.DOTALL)

new_return = """return (
    <div className="flex flex-col h-full min-h-screen bg-bg overflow-hidden relative">
      {/* Mobile Degradation Banner */}
      <div className="lg:hidden bg-accent text-white px-4 py-2 text-xs font-semibold text-center shrink-0 z-50">
        Best experienced on desktop / tablet screen.
      </div>

      {/* Top Contextual Header */}
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
          <button 
            onClick={() => {
              setViewMode('zen');
              document.documentElement.requestFullscreen().catch(err => console.log(err));
            }} 
            className="p-2 text-text-muted hover:text-ink hover:bg-surface-active rounded transition flex items-center gap-2" 
            title="Present Fullscreen"
          >
            <MonitorPlay size={16} strokeWidth={1.5} />
            <span className="text-xs font-semibold hidden md:inline">Present</span>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pages Sidebar */}
        <aside className="w-56 shrink-0 bg-surface-muted/60 flex flex-col border-r-[1.5px] border-surface-muted z-10 overflow-hidden">
          {pagesListJsx}
        </aside>

        {/* Center Canvas */}
        <section className="flex-1 overflow-auto bg-bg relative flex flex-col" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {viewMode === 'overview' ? overviewJsx : canvasJsx}
        </section>

        {/* Right Inspector */}
        <aside 
          className={`shrink-0 bg-surface flex flex-col border-l-[1.5px] border-surface-muted z-10 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${rightInspectorOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'}`}
        >
          <div className="w-72 shrink-0 h-full overflow-hidden flex flex-col">
            {rightSidebarJsx}
          </div>
        </aside>
      </div>

      {paletteEditState && (
        <PalettePopover
          block={paletteEditState.block}
          initialIndex={paletteEditState.index}
          anchorRect={paletteEditState.rect}
          onClose={() => setPaletteEditState(null)}
          onChange={(newBlock) => {
            persistPage({ ...activePage!, blocks: activePage!.blocks.map(b => b.id === newBlock.id ? newBlock : b) });
            setPaletteEditState(prev => prev ? { ...prev, block: newBlock } : null);
          }}
        />
      )}
      
      {/* Image Picker Modal */}
      {pickerBlockId && activePage && (
        <Modal title="Select Image" onClose={() => setPickerBlockId(null)}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => { assignImage(pickerBlockId, img.id); setPickerBlockId(null); }}
                className="group relative aspect-square rounded-lg overflow-hidden bg-surface-muted border-[1.5px] border-surface-muted hover:border-accent transition-all focus:outline-none focus:ring-[1.5px] focus:ring-accent focus:ring-offset-2"
              >
                <img
                  src={objectUrlFor(img.id, img.blob)}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Check className="text-white drop-shadow-md" size={24} strokeWidth={2} />
                </div>
              </button>
            ))}
          </div>
          {images.length === 0 && (
            <p className="text-sm text-text-muted">This project has no images yet.</p>
          )}
        </Modal>
      )}

      {/* True Fullscreen Zen / Presentation Overlay */}
      {viewMode === 'zen' && (
        <div className="fixed inset-0 z-[99999] bg-[#0F0F0F] flex flex-col items-center justify-center overflow-hidden">
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
          
          {/* Subtle progress / instructions at bottom */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[11px] font-bold tracking-widest uppercase flex items-center gap-8">
            <span>← Prev</span>
            <span className="text-white/90">Slide {pages.findIndex(p => p.id === activePageId) + 1} of {pages.length}</span>
            <span>Next →</span>
          </div>
          
          <button 
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
              setViewMode('focus');
            }}
            className="absolute top-6 right-6 text-white/50 hover:text-white p-2 transition-colors"
          >
            <span className="text-xs uppercase tracking-wider font-bold">Esc to Exit</span>
          </button>
        </div>
      )}
    </div>
  );
}"""

content = old_return.sub(new_return, content)

# 4. We also need to fix the keydown listener to exit fullscreen when pressing escape
content = content.replace("""        if (viewMode === 'zen') {
          setViewMode('focus');
        }""", """        if (viewMode === 'zen') {
          if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
          setViewMode('focus');
        }""")

# Also in canvasJsx, we no longer need the isZen hacks because canvasJsx isn't rendered or is rendered normally beneath the overlay!
# We can just remove the `viewMode === 'zen'` conditions from canvasJsx to keep it clean.
content = content.replace("${isZen ? 'ring-0' : ''}", "")
content = content.replace("showGridOverlay={isInteracting && viewMode !== 'zen'}", "showGridOverlay={isInteracting}")
content = content.replace("!isZen &&", "")
content = content.replace("""    <div className={`w-full max-w-6xl mx-auto ${viewMode === 'zen' ? 'h-full flex items-center justify-center p-8' : 'px-6 md:px-10 lg:px-12 py-6'}`}>""", """    <div className="w-full max-w-6xl mx-auto px-6 md:px-10 lg:px-12 py-6">""")

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated presentation modes")
