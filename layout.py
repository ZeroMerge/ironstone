import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

return_pattern = re.compile(r'return \(\s*<div className="flex flex-col md:flex-row h-full min-h-screen bg-bg">.*?</div>\n  \);\n\}', re.DOTALL)

new_return = """return (
    <div className="flex flex-col h-full min-h-screen bg-bg overflow-hidden relative">
      {/* Mobile Degradation Banner */}
      <div className="md:hidden bg-accent text-white px-4 py-2 text-xs font-semibold text-center shrink-0 z-50">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pages Sidebar (Fixed, Non-collapsible) */}
        <aside className="w-56 shrink-0 bg-surface-muted/60 flex flex-col border-r-[1.5px] border-surface-muted z-10 overflow-hidden">
          {pagesListJsx}
        </aside>

        {/* Center Canvas */}
        <section className="flex-1 overflow-auto bg-bg relative flex flex-col" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {viewMode === 'focus' ? canvasJsx : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm font-semibold">
              Multi-page Overview coming in Phase 21...
            </div>
          )}
        </section>

        {/* Right Inspector (Collapsible) */}
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
    </div>
  );
}"""

match = return_pattern.search(content)
if match:
    content = return_pattern.sub(new_return, content)
    with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated layout")
else:
    print("Pattern not found")
