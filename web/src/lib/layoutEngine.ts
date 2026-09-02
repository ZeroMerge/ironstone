import type { Block, ImageRec, Page } from './types';
import { COLS } from './grid';

export interface ImageProfile {
  id: string;
  w: number;
  h: number;
  ar: number;
  orientation: 'super-tall' | 'portrait' | 'square' | 'landscape' | 'panoramic';
}

export type LayoutEngineType = 'bento' | 'swiss' | 'editorial' | 'dual';
export type LayoutScope = 'active' | 'all' | 'custom';

/**
 * analyzeImageProfile utility:
 * Reads native pixel dimensions, computes exact aspect ratio (AR = w/h),
 * and categorizes into mathematical buckets.
 */
export async function extractProfiles(images: ImageRec[]): Promise<Map<string, ImageProfile>> {
  const map = new Map<string, ImageProfile>();

  const promises = images.map((img) => {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(img.blob);
      const image = new Image();
      image.onload = () => {
        const w = image.naturalWidth || 800;
        const h = image.naturalHeight || 800;
        const ar = w / h;

        let orientation: ImageProfile['orientation'] = 'square';
        if (ar < 0.65) orientation = 'super-tall';
        else if (ar <= 0.85) orientation = 'portrait';
        else if (ar < 1.2) orientation = 'square';
        else if (ar <= 1.6) orientation = 'landscape';
        else orientation = 'panoramic';

        map.set(img.id, { id: img.id, w, h, ar, orientation });
        URL.revokeObjectURL(url);
        resolve();
      };
      image.onerror = () => {
        map.set(img.id, { id: img.id, w: 800, h: 800, ar: 1.0, orientation: 'square' });
        URL.revokeObjectURL(url);
        resolve();
      };
      image.src = url;
    });
  });

  await Promise.all(promises);
  return map;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// 2D Spatial Occupancy Grid
class CanvasGrid {
  private grid: boolean[][];
  public rows: number;
  public cols: number;

  constructor(rows: number, cols: number = COLS) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(false));
  }

  public isFree(x: number, y: number, w: number, h: number): boolean {
    if (x < 0 || y < 0 || x + w > this.cols || y + h > this.rows) return false;
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (this.grid[r][c]) return false;
      }
    }
    return true;
  }

  public occupy(x: number, y: number, w: number, h: number): void {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (r < this.rows && c < this.cols) {
          this.grid[r][c] = true;
        }
      }
    }
  }

  public findFirstFreeSlot(w: number, h: number, startY: number = 0): { x: number; y: number } | null {
    for (let y = startY; y <= this.rows - h; y++) {
      for (let x = 0; x <= this.cols - w; x++) {
        if (this.isFree(x, y, w, h)) {
          return { x, y };
        }
      }
    }
    return null;
  }
}

/**
 * Layout a single page arranging ALL blocks (images, cards, titles, texts, quotes, specs, tags, palettes, dividers)
 * with mathematical precision and a ZERO-DROP guarantee.
 */
function layoutSinglePage({
  engineType,
  blocks,
  profiles,
  rows,
  pageSeed,
}: {
  engineType: LayoutEngineType;
  blocks: Block[];
  profiles: Map<string, ImageProfile>;
  rows: number;
  pageSeed: number;
}): Block[] {
  const canvas = new CanvasGrid(rows, COLS);
  const result: Block[] = [];

  const place = (b: Block, preferredX?: number, preferredY?: number): boolean => {
    if (preferredX !== undefined && preferredY !== undefined) {
      if (canvas.isFree(preferredX, preferredY, b.w, b.h)) {
        b.x = preferredX;
        b.y = preferredY;
        canvas.occupy(b.x, b.y, b.w, b.h);
        result.push(b);
        return true;
      }
    }
    const slot = canvas.findFirstFreeSlot(b.w, b.h, 0);
    if (slot) {
      b.x = slot.x;
      b.y = slot.y;
      canvas.occupy(b.x, b.y, b.w, b.h);
      result.push(b);
      return true;
    }
    return false;
  };

  // 1. HEADER RESERVATION (Title, Subtitle, Palette)
  const title = blocks.find(b => b.type === 'title');
  const subtitle = blocks.find(b => b.type === 'subtitle');
  const palette = blocks.find(b => b.type === 'palette');

  let contentStartY = 2;

  if (title) {
    title.w = Math.min(26, COLS - 4);
    title.h = 4;
    place(title, 2, 2);
    contentStartY = 7;
  }

  if (subtitle) {
    subtitle.w = Math.min(24, COLS - 4);
    subtitle.h = 3;
    place(subtitle, 2, title ? 6 : 2);
    contentStartY = Math.max(contentStartY, title ? 9 : 6);
  }

  if (palette) {
    palette.w = 16;
    palette.h = 4;
    // Harmonic top right placement
    place(palette, COLS - 18, 2);
  }

  // Content blocks to arrange
  const contentBlocks = blocks.filter(b => b !== title && b !== subtitle && b !== palette);

  // Group into visuals vs editorial
  const visuals = contentBlocks.filter(b => b.type === 'image' || b.type === 'card');
  const editorials = contentBlocks.filter(b => b.type !== 'image' && b.type !== 'card');

  // Sort visuals by visual mass (w * h)
  visuals.sort((a, b) => {
    const pA = profiles.get(a.content);
    const pB = profiles.get(b.content);
    const mA = pA ? pA.w * pA.h : 0;
    const mB = pB ? pB.w * pB.h : 0;
    return mB - mA;
  });

  const availableHeight = rows - contentStartY - 1;

  switch (engineType) {
    case 'swiss': {
      // SWISS STRICT 3-COLUMN MODERNIST
      // 3 equal 14-col columns at x = 2, 18, 34 with 2-col gutters
      const colsX = [2, 18, 34];
      const colBlocks: Block[][] = [[], [], []];

      // Interleave visuals and editorial blocks across columns
      const allToDistribute = [...visuals, ...editorials];
      allToDistribute.forEach((b, idx) => {
        colBlocks[(idx + pageSeed) % 3].push(b);
      });

      for (let c = 0; c < 3; c++) {
        const x = colsX[c];
        let currentY = contentStartY;
        const columnItems = colBlocks[c];
        const numItems = columnItems.length;

        columnItems.forEach((b) => {
          b.w = 14;
          let idealH = Math.floor(availableHeight / Math.max(1, numItems));
          if (b.type === 'moodTag') idealH = Math.min(idealH, 4);
          else if (b.type === 'text') idealH = Math.min(idealH, 6);
          else if (b.type === 'divider') idealH = 1;
          else if (b.type === 'quote') idealH = Math.min(idealH, 8);
          else if (b.type === 'specSheet') idealH = Math.min(idealH, 10);
          else idealH = Math.max(8, idealH);

          b.h = Math.max(2, Math.min(availableHeight - (currentY - contentStartY), idealH));
          if (!place(b, x, currentY)) {
            place(b);
          }
          currentY += b.h + 1;
        });
      }
      break;
    }

    case 'editorial': {
      // EDITORIAL HERO (60/40 GOLDEN RATIO)
      // 60% Hero Visual Flank (w: 26) + 40% Editorial Stack (w: 16)
      const heroOnLeft = pageSeed % 2 === 0;
      const heroX = heroOnLeft ? 2 : 30;
      const editorialX = heroOnLeft ? 30 : 2;
      const heroW = 26;
      const editorialW = 16;

      // 1. Visuals into 60% Flank
      let currentHeroY = contentStartY;
      visuals.forEach((v) => {
        v.w = heroW;
        v.h = Math.max(8, Math.floor(availableHeight / Math.max(1, visuals.length)));
        if (!place(v, heroX, currentHeroY)) {
          place(v);
        }
        currentHeroY += v.h + 1;
      });

      // 2. Editorials into 40% Flank
      let currentEdY = contentStartY;
      editorials.forEach((ed) => {
        ed.w = editorialW;
        let idealH = 6;
        if (ed.type === 'specSheet') idealH = 9;
        else if (ed.type === 'quote') idealH = 7;
        else if (ed.type === 'moodTag') idealH = 4;
        else if (ed.type === 'divider') idealH = 1;
        else if (ed.type === 'text') idealH = 5;

        ed.h = idealH;
        if (!place(ed, editorialX, currentEdY)) {
          place(ed);
        }
        currentEdY += ed.h + 1;
      });
      break;
    }

    case 'dual': {
      // DUAL FEATURE BALANCE
      // Paired 21-column symmetric frames (x = 2 and x = 25)
      const leftColBlocks: Block[] = [];
      const rightColBlocks: Block[] = [];

      const allToPlace = [...visuals, ...editorials];
      allToPlace.forEach((b, idx) => {
        if ((idx + pageSeed) % 2 === 0) leftColBlocks.push(b);
        else rightColBlocks.push(b);
      });

      const cols = [
        { x: 2, items: leftColBlocks },
        { x: 25, items: rightColBlocks },
      ];

      cols.forEach(({ x, items }) => {
        let currentY = contentStartY;
        items.forEach((b) => {
          b.w = 21;
          let idealH = Math.floor(availableHeight / Math.max(1, items.length));
          if (b.type === 'moodTag') idealH = Math.min(idealH, 4);
          else if (b.type === 'text') idealH = Math.min(idealH, 5);
          else if (b.type === 'divider') idealH = 1;
          else if (b.type === 'quote') idealH = Math.min(idealH, 7);
          else if (b.type === 'specSheet') idealH = Math.min(idealH, 9);
          else idealH = Math.max(8, idealH);

          b.h = Math.max(2, idealH);
          if (!place(b, x, currentY)) {
            place(b);
          }
          currentY += b.h + 1;
        });
      });
      break;
    }

    case 'bento':
    default: {
      // PINTEREST BENTO (ASPECT-RATIO AWARE MASONRY)
      if (visuals.length > 0) {
        const hero = visuals.shift()!;
        const prof = profiles.get(hero.content);
        const isPortrait = prof && prof.ar < 1;
        hero.w = isPortrait ? 20 : 26;
        hero.h = isPortrait ? Math.min(22, availableHeight) : Math.min(16, availableHeight);
        place(hero, pageSeed % 2 === 0 ? 2 : COLS - hero.w - 2, contentStartY);
      }

      // Interleave remaining visuals and editorial blocks
      const bentoItems = [...visuals, ...editorials];
      bentoItems.forEach((b) => {
        if (b.type === 'image' || b.type === 'card') {
          const prof = profiles.get(b.content);
          if (prof && (prof.orientation === 'super-tall' || prof.orientation === 'portrait')) {
            b.w = 14; b.h = 16;
          } else if (prof && prof.orientation === 'landscape') {
            b.w = 20; b.h = 10;
          } else {
            b.w = 16; b.h = 12;
          }
        } else if (b.type === 'specSheet') {
          b.w = 18; b.h = 9;
        } else if (b.type === 'quote') {
          b.w = 18; b.h = 7;
        } else if (b.type === 'moodTag') {
          b.w = 14; b.h = 4;
        } else if (b.type === 'text') {
          b.w = 14; b.h = 5;
        } else if (b.type === 'divider') {
          b.w = 20; b.h = 1;
        }

        if (!place(b)) {
          b.w = Math.max(10, Math.floor(b.w * 0.8));
          b.h = Math.max(2, Math.floor(b.h * 0.8));
          place(b);
        }
      });
      break;
    }
  }

  // 3. ZERO-DROP FAILSAFE PASS:
  // Guarantees that 100% of input blocks are placed on the canvas!
  const unplaced = blocks.filter(b => !result.some(r => r.id === b.id));
  unplaced.forEach(b => {
    b.w = Math.min(b.w, 14);
    b.h = Math.max(2, Math.min(b.h, 4));
    const slot = canvas.findFirstFreeSlot(b.w, b.h, 0);
    if (slot) {
      b.x = slot.x;
      b.y = slot.y;
      canvas.occupy(b.x, b.y, b.w, b.h);
      result.push(b);
    } else {
      b.x = 2;
      b.y = Math.min(rows - b.h, result.length * 2);
      result.push(b);
    }
  });

  return result;
}

/**
 * 2D Swiss Grid Constraint Packing Solver
 * Arranges ALL block types: Titles, Subtitles, Texts, Images, Cards, Quotes, SpecSheets, Tags, Dividers, Palettes.
 */
export async function applyAutoLayout({
  engineType,
  blocks,
  images,
  rows,
  seed = 0,
  scope = 'active',
  customPages = 1,
}: {
  engineType: LayoutEngineType;
  blocks: Block[];
  images: ImageRec[];
  rows: number;
  seed?: number;
  scope?: LayoutScope;
  customPages?: number;
}): Promise<Page[]> {
  const imageIds = new Set(
    blocks.filter(b => (b.type === 'image' || b.type === 'card') && b.content).map(b => b.content)
  );
  const relevantBlobs = images.filter(img => imageIds.has(img.id));
  const profiles = await extractProfiles(relevantBlobs);

  let targetPageCount = 1;
  if (scope === 'custom') {
    targetPageCount = Math.max(1, Math.min(10, customPages));
  } else if (scope === 'all') {
    targetPageCount = Math.max(1, Math.ceil(blocks.length / 6));
  }

  if (targetPageCount === 1) {
    // Single page: arrange ALL blocks on this page
    const pageBlocks = layoutSinglePage({
      engineType,
      blocks: blocks.map(b => ({ ...b })),
      profiles,
      rows,
      pageSeed: seed,
    });

    return [{
      id: uid(),
      projectId: 'active',
      order: 0,
      blocks: pageBlocks,
    }];
  }

  // Multi-page distribution: partition all blocks evenly across targetPageCount pages
  const pageBuckets: Block[][] = Array.from({ length: targetPageCount }, () => []);
  blocks.forEach((b, idx) => {
    pageBuckets[idx % targetPageCount].push({ ...b });
  });

  const generatedPages: Page[] = [];
  for (let pIdx = 0; pIdx < targetPageCount; pIdx++) {
    const pageBlocks = layoutSinglePage({
      engineType,
      blocks: pageBuckets[pIdx],
      profiles,
      rows,
      pageSeed: seed + pIdx,
    });

    generatedPages.push({
      id: uid(),
      projectId: 'active',
      order: pIdx,
      blocks: pageBlocks,
    });
  }

  return generatedPages;
}
