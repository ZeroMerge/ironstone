import type { Block } from '../lib/types';
import { Image as ImageIcon } from 'lucide-react';

/**
 * Presentational block content. Uses container-query units so typography
 * scales with the page at any size — editor canvas, thumbnails, and print.
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
    case 'image': {
      const crop = block.data?.crop;
      const objectPosition = crop ? `${crop.x}% ${crop.y}%` : undefined;
      const transform = crop && crop.zoom && crop.zoom !== 1 ? `scale(${crop.zoom})` : undefined;

      return imageUrl ? (
        <div className="w-full h-full overflow-hidden" style={radiusStyle}>
          <img
            src={imageUrl}
            className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-100"
            style={{
              objectPosition,
              transform,
            }}
            alt=""
          />
        </div>
      ) : (
        <div className="w-full h-full bg-surface-active flex items-center justify-center text-text-faint text-xs font-medium" style={radiusStyle}>
          No image
        </div>
      );
    }
    case 'card': {
      // Composite Image + Locked Caption Container
      const subPadding = block.data?.padding ?? 10;
      const captionText = block.data?.caption ?? 'FIG. 01 — ARCHIVAL REFERENCE / SS26';
      const crop = block.data?.crop;
      return (
        <div 
          className="w-full h-full bg-white shadow-sm border border-surface-muted/80 flex flex-col overflow-hidden select-none"
          style={{ ...radiusStyle, padding: `${subPadding}px` }}
        >
          <div className="flex-1 w-full min-h-0 relative overflow-hidden rounded-[calc(var(--block-radius,8px)-2px)] bg-surface-active/60">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-100"
                style={{
                  objectPosition: crop ? `${crop.x}% ${crop.y}%` : undefined,
                  transform: crop?.zoom && crop.zoom !== 1 ? `scale(${crop.zoom})` : undefined,
                }}
                alt=""
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-text-muted/60 p-2 text-center">
                <ImageIcon size={20} strokeWidth={1.5} />
                <span className="font-mono text-[1.1cqw] uppercase tracking-wider">Drop or double-click image</span>
              </div>
            )}
          </div>
          <div className="pt-2 shrink-0 overflow-hidden">
            <p className="font-mono uppercase tracking-[0.08em] font-medium leading-[1.3] text-[1.2cqw] text-text-muted truncate">
              {captionText}
            </p>
          </div>
        </div>
      );
    }
    case 'quote': {
      // Editorial Quote Block
      const quoteText = block.content || 'Good design is as little design as possible.';
      const author = block.data?.author || 'Dieter Rams';
      const source = block.data?.source || 'Ten Principles for Good Design';
      const quoteStyle = block.data?.quoteStyle ?? 'serif';

      return (
        <div 
          className="w-full h-full flex flex-col justify-between p-4 overflow-hidden bg-white/70 border border-surface-muted/60 shadow-sm select-none"
          style={radiusStyle}
        >
          <div className="flex-1 flex flex-col justify-start overflow-hidden">
            <span className="font-serif text-[6cqw] text-accent/40 leading-none select-none -mb-2">“</span>
            <p className={`leading-[1.25] text-[2.1cqw] text-ink overflow-hidden text-ellipsis line-clamp-4 ${quoteStyle === 'serif' ? 'font-serif italic' : 'font-sans font-medium'}`}>
              {quoteText}
            </p>
          </div>
          <div className="pt-2 border-t border-surface-muted/50 mt-auto shrink-0 flex items-center justify-between">
            <span className="font-mono uppercase tracking-[0.12em] font-semibold text-[1.1cqw] text-ink/80 truncate">
              — {author}
            </span>
            {source && (
              <span className="font-mono text-[1cqw] text-text-muted truncate ml-2">
                {source}
              </span>
            )}
          </div>
        </div>
      );
    }
    case 'specSheet': {
      // Studio Spec Sheet Block (Monospace structured metadata table)
      const client = block.data?.client || 'STUDIO ACNE';
      const date = block.data?.date || '2026.04.12';
      const season = block.data?.season || 'FW / 2026';
      const projectCode = block.data?.projectCode || 'IRN-SPEC-09';
      const leadDesigner = block.data?.leadDesigner || 'M. BORSCHE';

      const specs = [
        { label: 'CLIENT', value: client },
        { label: 'DATE', value: date },
        { label: 'SEASON', value: season },
        { label: 'CODE', value: projectCode },
        { label: 'LEAD', value: leadDesigner },
      ];

      return (
        <div 
          className="w-full h-full flex flex-col justify-between p-3.5 bg-white/90 border border-surface-muted/80 shadow-sm font-mono select-none overflow-hidden"
          style={radiusStyle}
        >
          <div className="flex items-center justify-between border-b border-surface-muted pb-1.5 mb-1 shrink-0">
            <span className="text-[1.1cqw] font-bold tracking-[0.15em] text-ink uppercase">Spec Sheet</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          </div>
          <div className="flex-1 flex flex-col justify-around py-0.5 min-h-0">
            {specs.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-[1.1cqw] leading-none py-0.5 border-b border-surface-muted/30 last:border-none">
                <span className="text-text-muted tracking-wider uppercase">{s.label}</span>
                <span className="font-semibold text-ink tracking-tight truncate max-w-[60%] text-right">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'moodTag': {
      // Mood Tag Block
      const tags: string[] = block.data?.tags || ['#Brutalism', '#FW26', '#Editorial', '#RawMaterials', '#Swiss'];
      const tagStyle = block.data?.style || 'filled';

      return (
        <div 
          className="w-full h-full flex flex-wrap gap-1.5 p-3 content-start bg-white/70 border border-surface-muted/60 shadow-sm select-none overflow-y-auto scrollbar-hide"
          style={radiusStyle}
        >
          {tags.map((t, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center px-2.5 py-1 rounded-full font-mono text-[1.1cqw] tracking-tight transition-all ${
                tagStyle === 'outline'
                  ? 'border border-ink/30 text-ink bg-transparent'
                  : 'bg-surface-active/80 text-ink border border-surface-muted shadow-2xs'
              }`}
            >
              {t.startsWith('#') ? t : `#${t}`}
            </span>
          ))}
        </div>
      );
    }
    case 'divider': {
      // Hairline Divider Block (horizontal or vertical 1px Swiss accent line)
      const isVertical = block.h > block.w;
      const lineStyle = block.data?.style || 'solid'; // 'solid' | 'dashed' | 'dotted'
      const opacity = (block.data?.opacity ?? 60) / 100;
      const color = block.data?.color || '#111110';

      return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden p-1 select-none">
          {isVertical ? (
            <div 
              className="h-full"
              style={{
                borderRightWidth: '1px',
                borderRightStyle: lineStyle,
                borderRightColor: color,
                opacity,
              }}
            />
          ) : (
            <div 
              className="w-full"
              style={{
                borderBottomWidth: '1px',
                borderBottomStyle: lineStyle,
                borderBottomColor: color,
                opacity,
              }}
            />
          )}
        </div>
      );
    }
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
    default:
      return (
        <div className="w-full h-full bg-surface-active/50 border border-dashed border-surface-muted flex items-center justify-center text-xs text-text-faint font-medium">
          {block.type}
        </div>
      );
  }
}
