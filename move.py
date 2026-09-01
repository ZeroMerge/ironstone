import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# First, remove them from the top (after zenMessage)
bad_injection = re.compile(r'  const duplicateBlock = useCallback\(\(blockId: string\) => \{.*?\}, \[project\]\);\n', re.DOTALL)
content = bad_injection.sub('', content)

# Now, find `const persistPage = useCallback((page: Page) => { ... }, []);` and insert after it.
# Actually let's just insert it before `const addPage = useCallback` where it should have been.
add_page = re.compile(r'  const addPage = useCallback')

good_injection = """  const duplicateBlock = useCallback((blockId: string) => {
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
    await updateProject(project.id, data); // We need to make sure we don't have TS2554 error here
  }, [project]);\n\n"""

content = add_page.sub(good_injection + "  const addPage = useCallback", content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Moved functions")
