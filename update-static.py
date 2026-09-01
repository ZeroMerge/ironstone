import re

with open('web/src/editor/BlockStatic.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make text blocks respect block.style.fontWeight, fontSize, textAlign
# We will apply a style object that pulls from block.style
new_block_static = """import type { Block, BlockStyle } from '../lib/types';
import React from 'react';

function textStyle(type: string, style?: BlockStyle): React.CSSProperties {
  const baseSize = type === 'title' ? 5 : type === 'subtitle' ? 2.4 : 1.8;
  const sizeMult = style?.fontSize || 1;
  return {
    textAlign: style?.textAlign || 'left',
    fontWeight: style?.fontWeight,
    fontStyle: style?.fontStyle,
    color: style?.color,
    fontSize: `${baseSize * sizeMult}cqw`,
  };
}

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
        <div className="w-full h-full flex items-end overflow-hidden" style={textStyle('title', block.style)}>
          <span className={`tracking-tight leading-none ${!block.style?.fontWeight ? 'font-extrabold' : ''}`}>
            {block.content || 'Untitled'}
          </span>
        </div>
      );
    case 'subtitle':
      return (
        <div className="w-full h-full flex items-start overflow-hidden" style={textStyle('subtitle', block.style)}>
          <span className={`leading-snug ${!block.style?.fontWeight ? 'font-semibold text-text-muted' : ''}`}>
            {block.content}
          </span>
        </div>
      );
    case 'text':
      return (
        <div className="w-full h-full overflow-hidden" style={textStyle('text', block.style)}>
          <span className={`leading-relaxed whitespace-pre-wrap ${!block.style?.color ? 'text-ink' : ''}`}>
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
        <div className="w-full h-full bg-surface-active flex items-center justify-center text-text-faint text-xs font-semibold" style={radiusStyle}>
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
    case 'bentoCard':
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
    f.write(new_block_static)
print("Updated BlockStatic")
