import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

right_jsx_pattern = re.compile(r'const rightSidebarJsx = \(.*?</button>\n\s*</div>\n\s*\)\}\n\s*</div>\n\s*</div>\n\s*\);', re.DOTALL)

new_right_jsx = """const rightSidebarJsx = (
    <div className="flex flex-col h-full w-full">
      {/* 4-Tab Segmented Header */}
      <div className="flex items-center p-1.5 bg-surface-muted/50 rounded-lg mx-4 mt-4 mb-6 border-[1.5px] border-surface-muted">
        {[
          { id: 'blocks', icon: <LayoutGrid size={14} />, label: 'Blocks' },
          { id: 'assets', icon: <ImageIcon size={14} />, label: 'Assets' },
          { id: 'styles', icon: <Palette size={14} />, label: 'Styles' },
          { id: 'presets', icon: <Columns size={14} />, label: 'Presets' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveInspectorTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all gap-1 ${activeInspectorTab === tab.id ? 'bg-white text-ink shadow-sm ring-[1.5px] ring-surface-muted' : 'text-text-muted hover:text-ink'}`}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {activeInspectorTab === 'blocks' && (
          <div className="flex flex-col gap-4">
            <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-2">Native Blocks</div>
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'palette' }))}
              className="card p-3 shadow-sm bg-surface flex flex-row items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition-all text-text-muted hover:text-ink select-none"
            >
              <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-muted rounded-md text-ink"><Palette size={14} strokeWidth={1.5} /></div>
              <span className="text-sm font-semibold">Color Palette</span>
            </div>
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'text' }))}
              className="card p-3 shadow-sm bg-surface flex flex-row items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition-all text-text-muted hover:text-ink select-none"
            >
              <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-muted rounded-md text-ink"><Type size={14} strokeWidth={1.5} /></div>
              <span className="text-sm font-semibold">Text Heading</span>
            </div>
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'bentoCard' }))}
              className="card p-3 shadow-sm bg-surface flex flex-row items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition-all text-text-muted hover:text-ink select-none"
            >
              <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-muted rounded-md text-ink"><Layers size={14} strokeWidth={1.5} /></div>
              <span className="text-sm font-semibold">Bento Frame</span>
            </div>
          </div>
        )}

        {activeInspectorTab === 'assets' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase">Project Assets ({images.length})</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {images.map(img => (
                <div 
                  key={img.id} 
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'image', content: img.id }))}
                  className="aspect-square rounded-md overflow-hidden bg-surface border-[1.5px] border-surface-muted cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition"
                >
                  <img src={objectUrlFor(img.id, img.blob)} className="w-full h-full object-cover pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeInspectorTab === 'styles' && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-3">Global Styles</div>
              <p className="text-xs text-text-muted">Document-wide visual settings (Coming in Phase 24).</p>
            </div>
          </div>
        )}

        {activeInspectorTab === 'presets' && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-3">Layout Presets</div>
              <p className="text-xs text-text-muted">Intelligent auto-layout engines (Coming in Phase 25).</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );"""

# Let's verify right_jsx_pattern finds it before substituting.
match = right_jsx_pattern.search(content)
if match:
    content = right_jsx_pattern.sub(new_right_jsx, content)
    with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated rightSidebarJsx")
else:
    print("rightSidebarJsx pattern NOT FOUND!")
