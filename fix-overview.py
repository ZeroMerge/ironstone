import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'const overviewJsx = \(\s*<div className="flex-1 overflow-y-auto p-8 bg-surface-muted/30 h-full">.*?</div>\n    </div>\n  \);', re.DOTALL)

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
                className="relative shadow-sm rounded overflow-hidden border border-surface-muted group-hover:border-accent group-hover:shadow-md transition-all bg-white cursor-grab active:cursor-grabbing"
                onClick={() => { setActivePageId(p.id); setViewMode('focus'); }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/ironstone-page', p.id);
                  e.dataTransfer.effectAllowed = 'move';
                  
                  // Hide the drag image ghost slightly or just let browser handle
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  
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
                    const adjustedTargetIdx = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
                    newPages.splice(adjustedTargetIdx, 0, removed);
                    
                    const updatedPages = newPages.map((pg, idx) => ({ ...pg, order: idx }));
                    setPages(updatedPages);
                    updatedPages.forEach(pg => persistPage(pg));
                  }
                }}
              >
                <GridSurface
                  orientation={project.orientation}
                  styles={project.styles}
                  className="w-full pointer-events-none"
                  showGridOverlay={false}
                >
                  {p.blocks.map((b) => (
                    <div 
                      key={b.id} 
                      style={blockStyle(b, rows)}
                      className="pointer-events-none"
                    >
                      <EditorBlockContent block={b} />
                    </div>
                  ))}
                </GridSurface>
                <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors pointer-events-none" />
                
                {/* Hover actions inside the card like Canva */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-ink shadow-sm rounded border border-surface-muted/50 cursor-pointer" title="Duplicate"><Copy size={12}/></button>
                  {pages.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-danger shadow-sm rounded border border-surface-muted/50 cursor-pointer" title="Delete"><Trash2 size={12}/></button>
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

if pattern.search(content):
    content = pattern.sub(new_overview, content)
    with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated overviewJsx")
else:
    print("Pattern not found")
