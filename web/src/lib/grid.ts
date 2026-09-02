import type { Block, BlockType, Orientation } from './types';

export const COLS = 48;

export function rowsFor(orientation: Orientation): number {
  // 48 columns by 32 rows for landscape (3:2 unit ratio for 297:210mm A4)
  // 48 columns by 48 rows for portrait
  return orientation === 'landscape' ? 32 : 48;
}

export function aspectFor(orientation: Orientation): string {
  return orientation === 'landscape' ? '297/210' : '210/297';
}

let counter = 0;
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Minimum footprint bounds for each block type in 48x32 grid units */
export function getMinFootprint(type: BlockType): { minW: number; minH: number } {
  switch (type) {
    case 'image':
      return { minW: 6, minH: 6 };
    case 'card':
      return { minW: 8, minH: 8 };
    case 'palette':
    case 'colorSwatch':
      return { minW: 8, minH: 2 };
    case 'title':
      return { minW: 8, minH: 3 };
    case 'subtitle':
      return { minW: 6, minH: 2 };
    case 'text':
      return { minW: 6, minH: 2 };
    case 'quote':
      return { minW: 8, minH: 4 };
    case 'specSheet':
      return { minW: 10, minH: 4 };
    case 'moodTag':
      return { minW: 4, minH: 2 };
    case 'divider':
      return { minW: 2, minH: 1 };
    default:
      return { minW: 2, minH: 2 };
  }
}

/** Clamps a block to valid 48x32 grid boundaries with minimum footprint enforcement */
export function clampBlock(b: Block, rows: number): Block {
  const { minW, minH } = getMinFootprint(b.type);
  const w = Math.max(minW, Math.min(COLS, Math.round(b.w)));
  const h = Math.max(minH, Math.min(rows, Math.round(b.h)));
  const x = Math.max(0, Math.min(COLS - w, Math.round(b.x)));
  const y = Math.max(0, Math.min(rows - h, Math.round(b.y)));
  return { ...b, x, y, w, h };
}

export function blocksOverlap(a: Block, b: Block): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 48×32 Precise Coordinate conversion to Screen / Container Pixels */
export function gridToPixel48(
  x: number,
  y: number,
  w: number,
  h: number,
  orientation: Orientation,
  containerWidth: number,
  containerHeight: number
) {
  const rows = rowsFor(orientation);
  return {
    left: (x / COLS) * containerWidth,
    top: (y / rows) * containerHeight,
    width: (w / COLS) * containerWidth,
    height: (h / rows) * containerHeight,
  };
}

/** Backward-compatible gridToPixel wrapper */
export const gridToPixel = gridToPixel48;

/** Screen Pixels to 48×32 Grid Snapping with Float Clamping */
export function pixelToGrid48(
  px: number,
  py: number,
  orientation: Orientation,
  containerWidth: number,
  containerHeight: number
) {
  const rows = rowsFor(orientation);
  const cellW = containerWidth / COLS;
  const cellH = containerHeight / rows;
  return {
    x: Math.max(0, Math.min(COLS - 1, Math.round(px / cellW))),
    y: Math.max(0, Math.min(rows - 1, Math.round(py / cellH))),
  };
}

/** Backward-compatible pixelToGrid wrapper */
export const pixelToGrid = pixelToGrid48;

/** Default 48×32 Starter Template */
export function templateBlocks(orientation: Orientation): Block[] {
  const blocks: Block[] = [];
  const push = (
    type: BlockType,
    x: number,
    y: number,
    w: number,
    h: number,
    content = '',
    style?: Block['style']
  ) => blocks.push({ id: uid(), type, x, y, w, h, content, style });

  if (orientation === 'landscape') {
    // 48 columns x 32 rows
    // Top Section (Row 2 to 8 = height 6)
    push('title', 2, 2, 18, 4, 'Moodboard Title');
    push('subtitle', 2, 6, 18, 2, 'Visual Direction & References');
    push('text', 22, 2, 24, 6, 'Describe the core aesthetic tone, texture, and concept notes here. Use this space to establish the conceptual foundation of the project.');
    
    // Bottom Section: Images (Row 10 to 30 = height 20)
    push('image', 2, 10, 22, 20);   // Hero image (left)
    push('image', 26, 10, 20, 9);   // Top right
    push('image', 26, 21, 9, 9);    // Bottom right 1
    push('image', 37, 21, 9, 9);    // Bottom right 2
  } else {
    // 48 columns x 48 rows
    // Top Section (Row 2 to 14)
    push('title', 2, 2, 44, 4, 'Moodboard Title');
    push('subtitle', 2, 6, 44, 2, 'Visual Direction & References');
    push('text', 2, 9, 44, 4, 'Describe the core aesthetic tone, texture, and concept notes here. Use this space to establish the conceptual foundation of the project.');

    // Bottom Section: Images (Row 15 to 46 = height 31)
    push('image', 2, 15, 44, 15);   // Hero top
    push('image', 2, 32, 14, 14);   // Bottom left
    push('image', 17, 32, 14, 14);  // Bottom middle
    push('image', 32, 32, 14, 14);  // Bottom right
  }
  return blocks;
}

/** Continuation 48×32 template for overflow pages */
export function continuationBlocks(orientation: Orientation): Block[] {
  const blocks: Block[] = [];
  const push = (type: BlockType, x: number, y: number, w: number, h: number, content = '') =>
    blocks.push({ id: uid(), type, x, y, w, h, content });

  if (orientation === 'landscape') {
    push('image', 0, 0, 24, 16);
    push('image', 24, 0, 24, 16);
    push('image', 0, 16, 24, 16);
    push('image', 24, 16, 24, 16);
  } else {
    push('image', 0, 0, 24, 24);
    push('image', 24, 0, 24, 24);
    push('image', 0, 24, 24, 24);
    push('image', 24, 24, 24, 24);
  }
  return blocks;
}

export function imageSlots(blocks: Block[]): Block[] {
  return blocks.filter((b) => b.type === 'image').sort((a, b) => a.y - b.y || a.x - b.x);
}
