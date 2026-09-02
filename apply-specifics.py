import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Task 1: Check scrollbar-hover on Right Inspector
# The right sidebar content is inside rightSidebarJsx, let's make sure scrollbar-hover is there.
# If rightSidebarJsx has scrollbar-hide, replace it with scrollbar-hover
content = content.replace('scrollbar-hide', 'scrollbar-hover')

# Task 2: Smooth fluid morphing toggle with smaller icons and rounded-full
toggle_pattern = re.compile(r'<div className="flex items-center bg-surface-muted/30 rounded-md p-0\.5">.*?</div>', re.DOTALL)
new_toggle = """<div className="flex items-center bg-surface-muted/50 rounded-full p-0.5 relative">
              <div 
                className={`absolute inset-y-0.5 w-[28px] bg-white rounded-full shadow-sm transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${viewMode === 'overview' ? 'left-[30px]' : 'left-0.5'}`}
              />
              <button 
                onClick={() => setViewMode('focus')}
                className={`relative w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-300 z-10 ${viewMode !== 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Focus View"
              >
                <Maximize2 size={12} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setViewMode('overview')}
                className={`relative w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-300 z-10 ${viewMode === 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Grid Overview"
              >
                <Grid2X2 size={12} strokeWidth={2.5} />
              </button>
            </div>"""
content = toggle_pattern.sub(new_toggle, content)

# Task 3: Background tiny bit darker (#EBEBEB)
content = content.replace('bg-bg overflow-hidden relative', 'bg-[#EBEBEB] overflow-hidden relative')

# Task 4: Sidebars max 30%, Center min-w-[400px]
# Update maxW logic
content = content.replace('const maxW = window.innerWidth * 0.4;', 'const maxW = window.innerWidth * 0.3;')

# Update Center Canvas min-width
canvas_pattern = re.compile(r'<section className="flex-1 overflow-auto scrollbar-hover bg-surface rounded-xl shadow-sm border border-surface-muted/50 relative flex flex-col"')
new_canvas = r'<section className="flex-1 min-w-[400px] overflow-auto scrollbar-hover bg-surface rounded-xl shadow-sm border border-surface-muted/50 relative flex flex-col"'
content = canvas_pattern.sub(new_canvas, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied specific fixes")
