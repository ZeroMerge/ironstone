import type { Block } from '../lib/types';

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
    case 'title': {
      const customStyle = {
        textAlign: block.style?.textAlign || 'left',
        letterSpacing: block.style?.letterSpacing ?? '-0.03em',
        fontSize: block.style?.fontSize ? `${block.style.fontSize}px` : undefined,
        fontWeight: block.style?.fontWeight ?? 800,
        color: block.style?.color ?? '#111110',
      };
      return (
        <div className="w-full h-full flex items-start overflow-hidden" style={customStyle}>
          <span className="font-extrabold tracking-tight leading-[1.08] text-[5cqw] w-full select-none">
            {block.content && (block.content.includes('<') && block.content.includes('>')) ? (
              <span dangerouslySetInnerHTML={{ __html: block.content }} />
            ) : (
              block.content || 'Untitled Moodboard'
            )}
          </span>
        </div>
      );
    }
    case 'subtitle': {
      const customStyle = {
        textAlign: block.style?.textAlign || 'left',
        letterSpacing: block.style?.letterSpacing,
        fontSize: block.style?.fontSize ? `${block.style.fontSize}px` : undefined,
        fontWeight: block.style?.fontWeight ?? 500,
        color: block.style?.color ?? '#575653',
      };
      return (
        <div className="w-full h-full flex items-start overflow-hidden" style={customStyle}>
          <span className="font-medium leading-[1.28] text-[2.4cqw] w-full select-none">
            {block.content && (block.content.includes('<') && block.content.includes('>')) ? (
              <span dangerouslySetInnerHTML={{ __html: block.content }} />
            ) : (
              block.content
            )}
          </span>
        </div>
      );
    }
    case 'text': {
      const customStyle = {
        textAlign: block.style?.textAlign || 'left',
        letterSpacing: block.style?.letterSpacing,
        fontSize: block.style?.fontSize ? `${block.style.fontSize}px` : undefined,
        fontWeight: block.style?.fontWeight ?? 400,
        color: block.style?.color ?? '#2E2D29',
      };
      return (
        <div className="w-full h-full flex items-start overflow-hidden" style={customStyle}>
          <span className="text-[1.8cqw] leading-[1.55] whitespace-pre-wrap w-full select-none">
            {block.content && (block.content.includes('<') && block.content.includes('>')) ? (
              <span dangerouslySetInnerHTML={{ __html: block.content }} />
            ) : (
              block.content
            )}
          </span>
        </div>
      );
    }
    case 'caption': {
      const customStyle = {
        textAlign: block.style?.textAlign || 'left',
        letterSpacing: block.style?.letterSpacing ?? '0.1em',
        fontSize: block.style?.fontSize ? `${block.style.fontSize}px` : undefined,
        fontWeight: block.style?.fontWeight ?? 500,
        color: block.style?.color ?? '#8C8983',
      };
      return (
        <div className="w-full h-full flex items-start overflow-hidden" style={customStyle}>
          <span className="font-mono uppercase tracking-[0.1em] leading-[1.4] text-[1.2cqw] w-full select-none">
            {block.content && (block.content.includes('<') && block.content.includes('>')) ? (
              <span dangerouslySetInnerHTML={{ __html: block.content }} />
            ) : (
              block.content
            )}
          </span>
        </div>
      );
    }
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
