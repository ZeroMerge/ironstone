import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove state
content = re.sub(r'const \[layoutMockup, setLayoutMockup\] = useState<.*?\(.*?\);\n\s*', '', content)

# 2. Clean up pagesListJsx
content = content.replace('className={`flex gap-3 overflow-x-auto items-stretch ${layoutMockup === \'vscode\' ? \'flex-col\' : \'flex-row\'}`}', 'className="flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-x-visible items-center md:items-stretch"')
content = content.replace('className={`group relative cursor-pointer rounded-lg p-2 transition-all flex-shrink-0 ${activePageId === p.id ? "bg-surface shadow-sm ring-[1.5px] ring-accent" : "hover:bg-surface/50"} ${layoutMockup === \'canva\' ? \'w-48\' : \'w-full\'}`}', 'className={`group relative cursor-pointer rounded-lg p-2 transition-all ${activePageId === p.id ? "bg-surface shadow-sm ring-[1.5px] ring-accent" : "hover:bg-surface/50"}`}')
content = content.replace('className={`rounded-md bg-surface p-3 text-sm font-semibold text-text-muted hover:text-ink flex flex-col items-center justify-center gap-2 shadow-sm transition border-[1.5px] border-dashed border-surface-muted flex-shrink-0 ${layoutMockup === \'canva\' ? \'w-32\' : \'w-full mt-2 py-4\'}`}', 'className="w-full rounded-md bg-surface px-3 py-2.5 text-sm font-semibold text-text-muted hover:text-ink inline-flex items-center justify-center gap-1.5 shadow-sm transition"')

# Fix the Add Page button interior (we replaced flex-col with inline-flex above)
content = content.replace("""<div className="flex items-center justify-center w-8 h-8 shrink-0 bg-surface-muted rounded-full">
              <Plus size={16} strokeWidth={1.5} />
            </div>
            Add page""", """<div className="flex items-center justify-center w-5 h-5 shrink-0">
              <Plus size={16} strokeWidth={1.5} />
            </div>
            Add page""")

# 3. Clean up rightSidebarJsx (remove the wrapping <aside> because we'll just inline its contents)
# Or wait, actually, if we just want to go back to "normal", we can put the "Add Blocks" back into the left sidebar,
# and put "Color Palette Strip" back into the Canvas Area at the bottom!
# This is tricky with regex. Let's just redefine the final return block to use the variables, but arrange them normally:
# Left sidebar = pagesListJsx + rightSidebarJsx (wait, rightSidebarJsx has Color Palette Strip which should be at the bottom of the canvas)
# Since the user created `rightSidebarJsx`, let's just look at the return block.

return_pattern = re.compile(r'return \(\s*<div className="flex flex-col h-full min-h-screen bg-bg relative overflow-hidden">.*?</div>\s*\);\s*\}', re.DOTALL)

normal_return = """return (
    <div className="flex flex-col md:flex-row h-full min-h-screen bg-bg">
      {/* Mobile Degradation Banner */}
      <div className="md:hidden bg-accent text-white px-4 py-2 text-xs font-semibold text-center shrink-0">
        Best experienced on desktop / tablet screen.
      </div>

      {/* Left Sidebar */}
      <aside className="w-full md:w-64 shrink-0 bg-surface-muted/60 flex md:flex-col overflow-y-auto overflow-x-auto p-4 gap-6">
        {pagesListJsx}
        {rightSidebarJsx}
      </aside>

      {/* Center Canvas */}
      <section className="flex-1 overflow-auto bg-bg relative flex flex-col" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {canvasJsx}
      </section>

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
                onClick={() => handleImageSelect(img)}
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

content = return_pattern.sub(normal_return, content)

# Clean up rightSidebarJsx wrapper so it fits in the left sidebar
content = content.replace('<div className="flex flex-col gap-6 w-full">\n      <aside\n        className="w-full md:w-64 shrink-0 bg-surface-muted/60 flex md:flex-col overflow-y-auto p-4 gap-6"\n      >', '<div className="flex flex-col gap-6 w-full mt-4">')
content = content.replace('</aside>\n    </div>', '</div>')

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Restored to normal")
