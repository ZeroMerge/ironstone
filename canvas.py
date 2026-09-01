import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace the content of canvasJsx to only include the GridSurface and the Color Palette Strip (if not moved to Right Inspector).
# Wait, Color Palette Strip should be in the canvas for now, or we can just keep it.
# Let's remove the <section> wrapping in canvasJsx, since it's already wrapped in <section> in the return block.
# And remove the Canvas Header Bar.

canvas_pattern = re.compile(r'  const canvasJsx = \(\s*<>\s*<section.*?<div className="w-full px-6 md:px-10 lg:px-12 py-6 max-w-6xl mx-auto">\s*{/\* Canvas Header Bar \*/}.*?</div>\s*</div>\s*</div>\s*{/\* Studio Style Bar \*/}.*?</div>\s*{/\* Grid Surface \*/}', re.DOTALL)

new_canvas = """  const canvasJsx = (
    <div className={`w-full max-w-6xl mx-auto ${viewMode === 'zen' ? 'h-full flex items-center justify-center p-8' : 'px-6 md:px-10 lg:px-12 py-6'}`}>
      {/* Grid Surface */}"""

content = canvas_pattern.sub(new_canvas, content)

# Now we need to remove the closing </section></> at the end of canvasJsx
closing_pattern = re.compile(r'          </div>\s*</div>\s*</section>\s*</>;', re.DOTALL)
new_closing = """          </div>\
        </div>\
      )}
    </div>
  );"""
content = closing_pattern.sub(new_closing, content)

# Also disable handles in Zen mode
content = content.replace("const editing = editingId === b.id;", "const editing = editingId === b.id;\n                    const isZen = viewMode === 'zen';")
content = content.replace("className={`absolute inset-0 ring-[1.5px] transition-colors pointer-events-none rounded-md ${", "className={`absolute inset-0 transition-colors pointer-events-none rounded-md ${isZen ? 'ring-0' : ''} ${")
content = content.replace("{selected && !isInteracting && (", "{selected && !isInteracting && !isZen && (")
content = content.replace("showGridOverlay={isInteracting}", "showGridOverlay={isInteracting && !isZen}")

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated canvasJsx")
