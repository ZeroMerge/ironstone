import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find a good spot inside Editor component, right after `const [zenMessage, setZenMessage] = useState<string | null>(null);`
inject_spot = re.compile(r'  const \[zenMessage, setZenMessage\] = useState<string \| null>\(null\);')

injection = """  const [zenMessage, setZenMessage] = useState<string | null>(null);

  const duplicateBlock = useCallback((blockId: string) => {
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
    await updateProject(project.id, data);
  }, [project]);"""

content = inject_spot.sub(injection, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Injected functions")
