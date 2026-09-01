import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add duplicateBlock handler
dup_block = """  const duplicateBlock = useCallback((blockId: string) => {
    if (!activePage) return;
    const blockToDup = activePage.blocks.find(b => b.id === blockId);
    if (!blockToDup) return;
    
    // Offset it slightly
    const newBlock = { 
      ...blockToDup, 
      id: uid(),
      x: Math.min(blockToDup.x + 2, COLS - blockToDup.w),
      y: Math.min(blockToDup.y + 2, rows - blockToDup.h)
    };
    persistPage({ ...activePage, blocks: [...activePage.blocks, newBlock] });
    setSelectedId(newBlock.id);
  }, [activePage, rows, persistPage]);

  const changeZIndex = useCallback((blockId: string, delta: number) => {
    if (!activePage) return;
    const block = activePage.blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const newZ = (block.zIndex || 10) + delta;
    persistPage({ ...activePage, blocks: activePage.blocks.map(b => b.id === blockId ? { ...b, zIndex: newZ } : b) });
  }, [activePage, persistPage]);"""

content = content.replace("  const duplicatePage = useCallback", dup_block + "\n\n  const duplicatePage = useCallback")

# Add floating pill inside the selected block render
pill_pattern = re.compile(r'\{/\* NW \*/\}')
new_pill = """{/* Floating Action Pill */}
                              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white border-[1.5px] border-surface-muted shadow-md rounded-lg p-1 flex items-center gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto">
                                 <button onClick={(e) => { e.stopPropagation(); duplicateBlock(b.id); }} className="p-1.5 text-text-muted hover:text-ink hover:bg-surface-active rounded transition" title="Duplicate (Ctrl+D)"><Copy size={14}/></button>
                                 <div className="w-px h-4 bg-surface-muted mx-1" />
                                 <button onClick={(e) => { e.stopPropagation(); changeZIndex(b.id, 1); }} className="p-1.5 text-text-muted hover:text-ink hover:bg-surface-active rounded transition" title="Bring Forward"><Layers size={14}/></button>
                                 <button onClick={(e) => { e.stopPropagation(); changeZIndex(b.id, -1); }} className="p-1.5 text-text-muted hover:text-ink hover:bg-surface-active rounded transition" title="Send Backward"><Layers size={14} className="opacity-50" /></button>
                                 <div className="w-px h-4 bg-surface-muted mx-1" />
                                 <button onClick={(e) => { e.stopPropagation(); removeSelected(); }} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition" title="Delete (Backspace)"><Trash2 size={14}/></button>
                              </div>
                              {/* NW */}"""

content = pill_pattern.sub(new_pill, content)

# Also apply zIndex to the blockStyle function
zindex_pattern = re.compile(r'return \{\s*position: \'absolute\',\s*left: `\$\{')
new_zindex = """return {
    position: 'absolute',
    zIndex: b.zIndex || 10,
    left: `${"""
content = zindex_pattern.sub(new_zindex, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added floating pill")
