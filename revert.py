import re
import os

# 1. Revert BlockStatic.tsx
old_block_static = """import type { Block } from '../lib/types';

/**
 * Presentational block content. Uses container-query units so typography
 * scales with the page at any size ?" editor canvas, thumbnails, and print.
 */
export default function BlockStatic({
  block,
  imageUrl,
  onSwatchClick,
}: {
  block: Block;
  imageUrl: string | null;
  onSwatchClick?: (index: number, e: React.MouseEvent) => void;
}) {
  const radiusStyle = {
    borderRadius: block.style?.borderRadius !== undefined 
      ? `${block.style.borderRadius}px` 
      : 'var(--block-radius, 8px)',
  };

  switch (block.type) {
    case 'title':
      return (
        <div className="w-full h-full flex items-end overflow-hidden" style={{ textAlign: block.style?.textAlign || 'left' }}>
          <span className="font-extrabold tracking-tight leading-none text-[5cqw]">
            {block.content || 'Untitled Moodboard'}
          </span>
        </div>
      );
    case 'subtitle':
      return (
        <div className="w-full h-full flex items-start overflow-hidden" style={{ textAlign: block.style?.textAlign || 'left' }}>
          <span className="font-semibold text-[2.4cqw] text-[#6E6C67] leading-snug">
            {block.content}
          </span>
        </div>
      );
    case 'text':
      return (
        <div className="w-full h-full overflow-hidden" style={{ textAlign: block.style?.textAlign || 'left' }}>
          <span className="text-[1.8cqw] leading-relaxed text-[#3d3c39] whitespace-pre-wrap">
            {block.content}
          </span>
        </div>
      );
    case 'image':
      return imageUrl ? (
        <img
          src={imageUrl}
          className="w-full h-full object-cover"
          style={radiusStyle}
          alt=""
        />
      ) : (
        <div className="w-full h-full bg-surface-active flex items-center justify-center text-text-faint text-xs font-medium" style={radiusStyle}>
          No image
        </div>
      );
    case 'palette':
      try {
        const data = block.data || { colors: ['#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563', '#374151'], format: 'hex' };
        const colors = data.colors || [];
        return (
          <div className="w-full h-full flex flex-col overflow-hidden bg-white shadow-sm border-[1.5px] border-surface-muted" style={radiusStyle}>
            <div className="flex-1 flex w-full">
              {colors.map((c: string, idx: number) => (
                <div key={idx} className="flex-1 h-full cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: c }} onClick={(e) => onSwatchClick?.(idx, e)} />
              ))}
            </div>
          </div>
        );
      } catch (e) {
        return null;
      }
    case 'card':
      return (
        <div className="w-full h-full bg-surface border-[1.5px] border-surface-muted shadow-sm p-4 flex flex-col gap-2" style={radiusStyle}>
          <div className="w-8 h-8 rounded-full bg-surface-active shrink-0" />
          <div className="w-2/3 h-2 bg-surface-muted rounded-full" />
          <div className="w-1/2 h-2 bg-surface-muted rounded-full" />
        </div>
      );
    default:
      return (
        <div className="w-full h-full bg-surface-active/50 border border-dashed border-surface-muted flex items-center justify-center text-xs text-text-faint font-medium">
          {block.type}
        </div>
      );
  }
}
"""
with open('web/src/editor/BlockStatic.tsx', 'w', encoding='utf-8') as f:
    f.write(old_block_static)


# 2. Revert Editor.tsx
with open('web/src/pages/Editor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove import
content = content.replace("import TopContextBar from '../editor/TopContextBar';\n", "")

# Remove functions
fns_pattern = re.compile(r'  const duplicateBlock = useCallback\(\(blockId: string\) => \{.*?\}, \[project\]\);\n\n', re.DOTALL)
content = fns_pattern.sub('', content)

# Remove zIndex from blockStyle
zindex_pattern = re.compile(r'    zIndex: b\.zIndex \|\| 10,\n')
content = zindex_pattern.sub('', content)

# Remove Floating Pill
pill_pattern = re.compile(r'\{/\* Floating Action Pill \*/\}.*?\{/\* NW \*/\}', re.DOTALL)
content = pill_pattern.sub('{/* NW */}', content)

# Revert Top Contextual Bar Placeholder
bar_pattern = re.compile(r'\{\/\* Dynamic Contextual Property Bar \(Phase 22\) \*\/\}\s*<TopContextBar.*?/>', re.DOTALL)
old_bar = """{/* Dynamic Contextual Property Bar (Phase 22) */}
        <div className="flex-1 flex justify-center text-xs font-medium text-text-muted">
          {selectedId ? "Block Properties (Phase 22)" : "Document Canvas"}
        </div>"""
content = bar_pattern.sub(old_bar, content)

with open('web/src/pages/Editor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 3. Delete TopContextBar.tsx
if os.path.exists('web/src/editor/TopContextBar.tsx'):
    os.remove('web/src/editor/TopContextBar.tsx')

print("Reverted all Phase 22 changes")
