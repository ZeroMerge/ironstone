import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pages_jsx_pattern = re.compile(r'const pagesListJsx = \(\s*<>\s*<div className="text-\[11px\] font-bold text-text-muted/70 tracking-wider uppercase mb-3">\s*Pages \(\{pages\.length\}\)\s*</div>.*?</>\s*\);', re.DOTALL)

new_pages_jsx = """const pagesListJsx = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-2 mt-2">
        <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase">
          Pages ({pages.length})
        </div>
        <button onClick={addPage} className="p-1 text-text-muted hover:text-ink hover:bg-surface-active rounded transition" title="Add Page">
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto px-2 pb-4">
        {pages.map((p, i) => (
          <div
            key={p.id}
            onClick={() => {
              setActivePageId(p.id);
              setSelectedId(null);
              if (viewMode === 'overview') setViewMode('focus');
            }}
            className={`group relative cursor-pointer rounded-lg p-2 transition-all flex-shrink-0 ${activePageId === p.id && viewMode === 'focus' ? "bg-surface shadow-sm ring-[1.5px] ring-accent" : "hover:bg-surface/50"}`}
          >
            <div className="pointer-events-none rounded overflow-hidden shadow-sm border-[1.5px] border-surface-muted bg-white">
              <GridSurface
                orientation={project.orientation}
                styles={project.styles}
                className="w-full pointer-events-none"
              >
                {p.blocks.map((b) => (
                  <div key={b.id} style={blockStyle(b, rows)}>
                    <EditorBlockContent block={b} />
                  </div>
                ))}
              </GridSurface>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-text-muted">
              <span className="font-semibold">Page {i + 1}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicatePage(p.id);
                  }}
                  className="p-1 text-text-faint hover:text-ink rounded"
                  title="Duplicate page"
                >
                  <Copy size={12} strokeWidth={1.5} />
                </button>
                {pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(p.id);
                    }}
                    className="p-1 text-text-faint hover:text-danger rounded"
                    title="Delete page"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t-[1.5px] border-surface-muted/50 px-2 flex justify-center">
        <button 
          onClick={() => setViewMode(viewMode === 'overview' ? 'focus' : 'overview')}
          className={`flex items-center gap-2 px-3 py-2 w-full justify-center rounded-md text-xs font-semibold transition-all ${viewMode === 'overview' ? 'bg-accent text-white shadow-sm' : 'bg-surface hover:bg-surface-active text-text-muted hover:text-ink border-[1.5px] border-surface-muted'}`}
        >
          <Grid2X2 size={14} strokeWidth={2} />
          {viewMode === 'overview' ? 'Exit Overview' : 'Overview'}
        </button>
      </div>
    </div>
  );"""

content = pages_jsx_pattern.sub(new_pages_jsx, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated pagesListJsx")
