import re

with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the mangled section with a clean one
pattern = re.compile(r'\{\/\* Color Palette Strip \*\/}\s*\{viewMode !== \'zen\' && <div className="mt-8">.*?</div>\s*</div>\s*\{paletteEditState', re.DOTALL)

clean_palette = """{/* Color Palette Strip */}
          {viewMode !== 'zen' && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold text-text-muted">Color Palette</p>
                <button
                  className="btn-ghost !px-2 !py-1 text-xs"
                  disabled={paletteBusy}
                  onClick={() => generatePalette('project')}
                >
                  {paletteBusy ? 'Extracting...' : 'From all images'}
                </button>
                <button
                  className="btn-ghost !px-2 !py-1 text-xs"
                  disabled={paletteBusy}
                  onClick={() => generatePalette('page')}
                >
                  From this page
                </button>
              </div>
              {palette.length > 0 && (
                <div className="flex items-center gap-2">
                  {palette.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => addSwatch(hex)}
                      title={`Add ${hex} to page`}
                      className="group relative w-12 h-12 rounded-md shadow-sm transition hover:scale-105"
                      style={{ backgroundColor: hex }}
                    >
                      <span className="absolute inset-x-0 -bottom-5 text-center text-[10px] font-semibold text-text-faint opacity-0 group-hover:opacity-100 transition">
                        {hex}
                      </span>
                    </button>
                  ))}
                  <p className="ml-2 text-xs text-text-faint">Click a swatch to add it to the page.</p>
                </div>
              )}
            </div>
          )}
        </div>
      {paletteEditState"""

if pattern.search(content):
    content = pattern.sub(clean_palette, content)
    with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed palette")
else:
    print("Pattern not found")
