import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
import_pattern = re.compile(r'import PalettePopover from \'../editor/PalettePopover\';')
content = import_pattern.sub("import PalettePopover from '../editor/PalettePopover';\nimport TopContextBar from '../editor/TopContextBar';", content)

# Add updateProject handler wrapper if not there
# Wait, updateProject from repo is a function: updateProject(id, data).
# Let's add a local handler
local_handler = """  const handleUpdateProject = useCallback(async (data: Partial<Project>) => {
    if (!project) return;
    const updated = { ...project, ...data };
    setProject(updated);
    await updateProject(project.id, data);
  }, [project]);"""

# Insert it before `const addPage = useCallback`
add_page_pattern = re.compile(r'  const addPage = useCallback')
content = add_page_pattern.sub(local_handler + "\n\n  const addPage = useCallback", content)

# Replace the placeholder in the return block
placeholder_pattern = re.compile(r'\{\/\* Dynamic Contextual Property Bar \(Phase 22\) \*\/\}\s*<div className="flex-1 flex justify-center text-xs font-medium text-text-muted">\s*\{selectedId \? "Block Properties \(Phase 22\)" : "Document Canvas"\}\s*<\/div>')
new_bar = """{/* Dynamic Contextual Property Bar (Phase 22) */}
          <TopContextBar 
            project={project}
            activePage={activePage}
            selectedId={selectedId}
            updateProject={handleUpdateProject}
            updateBlock={(id, updates) => {
              if (!activePage) return;
              const newBlocks = activePage.blocks.map(b => b.id === id ? { ...b, ...updates } : b);
              persistPage({ ...activePage, blocks: newBlocks });
            }}
          />"""
content = placeholder_pattern.sub(new_bar, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Editor.tsx with TopContextBar")
