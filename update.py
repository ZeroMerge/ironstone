import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update left sidebar
left_sidebar_new = """      {/* Left Page Thumbnails Sidebar */}
      <aside
        className={elative shrink-0 bg-surface-muted/30 border-r-[1.5px] border-surface-muted flex md:flex-col overflow-y-auto overflow-x-auto transition-all duration-300 }
      >
        <button
          onClick={() => setLeftOpen(!leftOpen)}
          className="hidden md:flex absolute -right-3 top-6 bg-surface border-[1.5px] border-surface-muted rounded-full p-1 z-10 hover:bg-surface-active text-text-muted transition-transform"
        >
          {leftOpen ? <ArrowLeft size={14} strokeWidth={1.5} /> : <Layers size={14} strokeWidth={1.5} />}
        </button>

        {leftOpen ? (
          <>
            <div className="hidden md:block text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-1">
              Pages ({pages.length})
            </div>
            <div className="flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-x-visible items-center md:items-stretch">
              {pages.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setActivePageId(p.id);
                    setSelectedId(null);
                  }}
                  className={group relative cursor-pointer rounded-lg p-2 transition-all }
                >
                  <div className="pointer-events-none rounded overflow-hidden">
                    <GridSurface
                      orientation={project.orientation}
                      styles={project.styles}
                      className="w-full pointer-events-none"
                    >
                      {p.blocks.map((b) => (
                        <div key={b.id} style={blockStyle(b, rows)}>
                          <EditorBlockContent block={b} onSwatchClick={(idx, e) => { e.stopPropagation(); setPaletteEditState({ block: b, index: idx, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }); }} />
                        </div>
                      ))}
                    </GridSurface>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-text-muted">
                    <span className="font-semibold">Page {i + 1}</span>
                    {pages.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePage(p.id);
                        }}
                        className="p-1 text-text-faint hover:text-danger rounded opacity-0 group-hover:opacity-100 transition"
                        aria-label={Delete page }
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addPage}
                className="w-full rounded-md bg-surface px-3 py-2.5 text-sm font-semibold text-text-muted hover:text-ink inline-flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <div className="flex items-center justify-center w-5 h-5 shrink-0">
                  <Plus size={16} strokeWidth={1.5} />
                </div>
                Add page
              </button>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-col gap-3 w-full mt-8">
            {pages.map((p, i) => (
              <div
                key={p.id}
                onClick={() => {
                  setActivePageId(p.id);
                  setSelectedId(null);
                }}
                className={w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer transition-all mx-auto }
                title={Page }
              >
                {i + 1}
              </div>
            ))}
            <button
              onClick={addPage}
              className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-ink shadow-sm transition mx-auto mt-2"
              title="Add page"
            >
              <Plus size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </aside>"""

# Replace the left sidebar chunk
start_idx = content.find('{/* Left Page Thumbnails Sidebar */}')
end_idx = content.find('</aside>', start_idx) + len('</aside>')

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + left_sidebar_new + content[end_idx:]
else:
    print("Could not find left sidebar boundaries.")

# 2. Extract Color Palette Strip to put in Right Sidebar
import re
color_strip_pattern = re.compile(r'\{\/\* Color Palette Strip \*\/\}.*?<\/div>\s*\}\)\}\s*<\/div>\s*<\/div>', re.DOTALL)
match = color_strip_pattern.search(content)
color_strip_code = match.group(0) if match else ""
if match:
    content = content[:match.start()] + content[match.end():]

# 3. Create Right Sidebar
right_sidebar_code = """
      {/* Right Tools Sidebar */}
      <aside
        className={elative shrink-0 bg-surface-muted/30 border-l-[1.5px] border-surface-muted flex md:flex-col overflow-y-auto transition-all duration-300 }
      >
        <button
          onClick={() => setRightOpen(!rightOpen)}
          className="hidden md:flex absolute -left-3 top-6 bg-surface border-[1.5px] border-surface-muted rounded-full p-1 z-10 hover:bg-surface-active text-text-muted transition-transform"
        >
          {rightOpen ? <ArrowLeft size={14} strokeWidth={1.5} className="rotate-180" /> : <Plus size={14} strokeWidth={1.5} />}
        </button>

        {rightOpen ? (
          <>
            {/* Add Blocks Drawer */}
            <div>
              <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-3">
                Add Blocks
              </div>
              <div className="flex flex-col gap-2">
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'palette' }));
                  }}
                  className="card p-3 shadow-sm bg-surface flex flex-row items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition-all text-text-muted hover:text-ink select-none"
                >
                  <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-muted rounded-md text-ink">
                    <Palette size={14} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ink leading-tight">Color Palette</span>
                    <span className="text-[10px] text-text-faint font-medium">Extracts page colors</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Project Tools */}
            <div className="mt-4 pt-4 border-t-[1.5px] border-surface-muted">
              __COLOR_STRIP_PLACEHOLDER__
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-col gap-4 w-full mt-8 items-center">
            <button
              onClick={() => setRightOpen(true)}
              className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-ink shadow-sm transition"
              title="Add Palette"
            >
              <Palette size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </aside>
"""
if color_strip_code:
    # Need to clean up the margins of color strip since it's going into a sidebar
    clean_color_strip = color_strip_code.replace('className="mt-8"', 'className="flex flex-col gap-3"')
    clean_color_strip = clean_color_strip.replace('className="flex items-center gap-2 mb-3"', 'className="flex flex-col items-start gap-2 mb-3"')
    clean_color_strip = clean_color_strip.replace('className="text-xs font-bold text-text-muted"', 'className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase"')
    right_sidebar_code = right_sidebar_code.replace('__COLOR_STRIP_PLACEHOLDER__', clean_color_strip)
else:
    right_sidebar_code = right_sidebar_code.replace('__COLOR_STRIP_PLACEHOLDER__', '')

# Insert right sidebar right after the canvas section ends
section_end_idx = content.find('</section>') + len('</section>')
if section_end_idx != -1 + len('</section>'):
    content = content[:section_end_idx] + right_sidebar_code + content[section_end_idx:]

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully")
