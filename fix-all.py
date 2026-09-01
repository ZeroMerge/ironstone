import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

injection = """  const duplicateBlock = useCallback((blockId: string) => {
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
  }, [activePage, persistPage]);

  const handleUpdateProject = useCallback(async (data: Partial<Project>) => {
    if (!project) return;
    const updated = { ...project, ...data };
    setProject(updated);
    await updateProject(updated);
  }, [project]);\n\n"""

content = content.replace("  async function addPage() {", injection + "  async function addPage() {")

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Injected functions successfully")
