import type { CSSProperties, ReactNode } from 'react';
import type { Orientation, ProjectStyles } from '../lib/types';
import { aspectFor, COLS, rowsFor } from '../lib/grid';

interface GridSurfaceProps {
  orientation: Orientation;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  styles?: ProjectStyles;
  showGridOverlay?: boolean;
}

export default function GridSurface({
  orientation,
  children,
  className = '',
  style,
  styles,
  showGridOverlay = false,
}: GridSurfaceProps) {
  const rows = rowsFor(orientation);
  const margin = styles?.margin ?? 0;
  const gap = styles?.gridGap ?? 0;
  const radius = styles?.cornerRadius ?? 8;
  const tone = styles?.canvasTone ?? 'studio';
  const font = styles?.fontPairing ?? 'sans';

  const toneConfig: Record<string, { bg: string; text: string; gridColor: string }> = {
    studio: { bg: '#FFFFFF', text: '#111110', gridColor: '#111110' },
    linen: { bg: '#F6F4EE', text: '#1C1B18', gridColor: '#1C1B18' },
    slate: { bg: '#ECEBE8', text: '#111110', gridColor: '#111110' },
    obsidian: { bg: '#111110', text: '#FAFAF9', gridColor: '#FAFAF9' },
  };

  const fontFamilies: Record<string, string> = {
    sans: 'Manrope, sans-serif',
    serif: 'Newsreader, "Playfair Display", Georgia, serif',
    mono: '"JetBrains Mono", monospace',
  };

  const currentTone = toneConfig[tone] ?? toneConfig.studio;
  const currentFont = fontFamilies[font] ?? fontFamilies.sans;

  return (
    <div
      className={`relative transition-colors duration-300 rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.2)] ${className}`}
      style={{
        aspectRatio: aspectFor(orientation),
        containerType: 'inline-size',
        backgroundColor: currentTone.bg,
        color: currentTone.text,
        fontFamily: currentFont,
        ['--block-radius' as any]: `${radius}px`,
        ['--grid-gap' as any]: `${gap}px`,
        ...style,
      }}
      data-grid-surface
    >
      <div
        className="absolute inset-0"
        style={{
          padding: margin > 0 ? `${(margin / 800) * 100}%` : undefined,
        }}
      >
        <div className="relative w-full h-full" data-grid-inner>
          {/* Dynamic SVG 48x32 Micro-Grid Overlay during Drag/Resize */}
          {showGridOverlay && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-25 transition-opacity duration-200"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="micro-grid-48"
                  width={`${100 / COLS}%`}
                  height={`${100 / rows}%`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 0 0 L 100 0 M 0 0 L 0 100"
                    fill="none"
                    stroke={currentTone.gridColor}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="2,2"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#micro-grid-48)" />
            </svg>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

export function blockStyle(
  b: { x: number; y: number; w: number; h: number; zIndex?: number },
  rows: number
): CSSProperties {
  return {
    position: 'absolute',
    left: `${(b.x / COLS) * 100}%`,
    top: `${(b.y / rows) * 100}%`,
    width: `${(b.w / COLS) * 100}%`,
    height: `${(b.h / rows) * 100}%`,
    zIndex: b.zIndex ?? 1,
    boxSizing: 'border-box',
  };
}

export { rowsFor, COLS };
