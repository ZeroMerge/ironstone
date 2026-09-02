import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace("ArrowLeftToLine, ", "")
content = content.replace("ArrowRightToLine, ", "")
content = content.replace("from 'lucide-react';", "PanelLeft, PanelRight, Layout, LayoutGrid } from 'lucide-react';")

# 2. Update Header
header_pattern = re.compile(r'<header className="h-14 bg-transparent flex items-center px-4 md:px-6 justify-between shrink-0 z-20">.*?</header>', re.DOTALL)
new_header = """<header className="h-14 bg-transparent flex items-center px-4 md:px-6 justify-between shrink-0 z-20">
        <div className="flex items-center gap-4 text-sm text-text-muted w-1/4">
          <Link to={`/projects/${id}`} className="inline-flex items-center gap-2 hover:text-ink transition-colors font-semibold">
            <ArrowLeft size={16} strokeWidth={2} />
            <span className="truncate">{project.name}</span>
          </Link>
          <div className="w-px h-4 bg-surface-muted mx-1" />
          <button 
            onClick={() => setLeftOpen(!leftOpen)}
            className={`p-1.5 rounded-md transition-colors ${leftOpen ? 'text-ink bg-surface shadow-sm border border-surface-muted/50' : 'text-text-muted hover:text-ink hover:bg-surface-active'}`}
            title="Toggle Left Sidebar"
          >
            <PanelLeft size={16} strokeWidth={1.5} fill={leftOpen ? "currentColor" : "none"} />
          </button>
        </div>
        
        {/* Dynamic Contextual Property Bar (Phase 22) */}
        <div className="flex-1 flex justify-center items-center gap-6 text-xs font-medium text-text-muted">
          <span>{selectedId ? "Block Properties (Phase 22)" : "Document Canvas"}</span>
          
          {!selectedId && (
            <div className="flex items-center bg-surface-muted/50 rounded-md p-0.5 relative">
              <div 
                className={`absolute inset-y-0.5 w-[28px] bg-white rounded-[4px] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${viewMode === 'overview' ? 'left-[30px]' : 'left-0.5'}`}
              />
              <button 
                onClick={() => setViewMode('focus')}
                className={`relative w-7 h-7 flex items-center justify-center rounded-[4px] transition-colors duration-300 z-10 ${viewMode !== 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Focus View"
              >
                <Layout size={12} strokeWidth={2} fill={viewMode !== 'overview' ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={() => setViewMode('overview')}
                className={`relative w-7 h-7 flex items-center justify-center rounded-[4px] transition-colors duration-300 z-10 ${viewMode === 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Grid Overview"
              >
                <LayoutGrid size={12} strokeWidth={2} fill={viewMode === 'overview' ? "currentColor" : "none"} />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end gap-3 w-1/4">
          <button 
            onClick={() => setRightInspectorOpen(!rightInspectorOpen)}
            className={`p-1.5 rounded-md transition-colors ${rightInspectorOpen ? 'text-ink bg-surface shadow-sm border border-surface-muted/50' : 'text-text-muted hover:text-ink hover:bg-surface-active'}`}
            title="Toggle Right Inspector"
          >
            <PanelRight size={16} strokeWidth={1.5} fill={rightInspectorOpen ? "currentColor" : "none"} />
          </button>
        </div>
      </header>"""
content = header_pattern.sub(new_header, content)

# 3. Remove Floating Pill from Canvas Section
pill_pattern = re.compile(r'\{\/\* Floating Panel Toggle Pill \*\/\}\s*\{viewMode !== \'zen\' && \(\s*<div className="absolute bottom-6 left-6 z-40.*?</div>\s*\)\}', re.DOTALL)
content = pill_pattern.sub('', content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated header toggles and removed floating pill")
