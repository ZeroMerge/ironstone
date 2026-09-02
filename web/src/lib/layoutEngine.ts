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

  public findFirstFreeSlot(w: number, h: number): { x: number; y: number } | null {
    for (let y = 0; y <= this.rows - h; y++) {
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
  // Extract mathematical aspect ratio profiles for images and cards
  const imageIds = new Set(
    blocks.filter(b => (b.type === 'image' || b.type === 'card') && b.content).map(b => b.content)
  );
  const relevantBlobs = images.filter(img => imageIds.has(img.id));
  const profiles = await extractProfiles(relevantBlobs);

  // Group all blocks by category
  const titleBlocks = blocks.filter(b => b.type === 'title');
  const subtitleBlocks = blocks.filter(b => b.type === 'subtitle');
  const paletteBlocks = blocks.filter(b => b.type === 'palette');
  const imageBlocks = blocks.filter(b => b.type === 'image');
  const cardBlocks = blocks.filter(b => b.type === 'card');
  const quoteBlocks = blocks.filter(b => b.type === 'quote');
  const specBlocks = blocks.filter(b => b.type === 'specSheet');
  const tagBlocks = blocks.filter(b => b.type === 'moodTag');
  const textBlocks = blocks.filter(b => b.type === 'text' || b.type === 'caption');
  const dividerBlocks = blocks.filter(b => b.type === 'divider');

  // Hero Image Scoring: visual mass (w * h)
  const sortedVisualBlocks = [...imageBlocks, ...cardBlocks].sort((a, b) => {
    const profA = profiles.get(a.content);
    const profB = profiles.get(b.content);
    const massA = profA ? profA.w * profA.h : 0;
    const massB = profB ? profB.w * profB.h : 0;
    return massB - massA;
  });

  // Calculate target page count
  let targetPageCount = 1;
  if (scope === 'custom') {
    targetPageCount = Math.max(1, Math.min(10, customPages));
  } else if (scope === 'all') {
    targetPageCount = Math.max(1, Math.ceil(blocks.length / 6));
  }

  // Queues for distribution
  const unplacedTitles = [...titleBlocks];
  const unplacedSubtitles = [...subtitleBlocks];
  const unplacedPalettes = [...paletteBlocks];
  const unplacedVisuals = [...sortedVisualBlocks];
  const unplacedQuotes = [...quoteBlocks];
  const unplacedSpecs = [...specBlocks];
  const unplacedTags = [...tagBlocks];
  const unplacedTexts = [...textBlocks];
  const unplacedDividers = [...dividerBlocks];

  const generatedPages: Page[] = [];

  for (let pageIdx = 0; pageIdx < targetPageCount; pageIdx++) {
    const pageBlocks: Block[] = [];
    const canvas = new CanvasGrid(rows, COLS);
    const isHeroPage = pageIdx === 0;
    const pageSeed = seed + pageIdx;

    const place = (b: Block, preferredX?: number, preferredY?: number): boolean => {
      if (preferredX !== undefined && preferredY !== undefined) {
        if (canvas.isFree(preferredX, preferredY, b.w, b.h)) {
          b.x = preferredX;
          b.y = preferredY;
          canvas.occupy(b.x, b.y, b.w, b.h);
          pageBlocks.push(b);
          return true;
        }
      }
      const slot = canvas.findFirstFreeSlot(b.w, b.h);
      if (slot) {
        b.x = slot.x;
        b.y = slot.y;
        canvas.occupy(b.x, b.y, b.w, b.h);
        pageBlocks.push(b);
        return true;
      }
      return false;
    };

    // 1. NEGATIVE SPACE RESERVATION (Title & Palette)
    if (unplacedTitles.length > 0) {
      const title = unplacedTitles.shift()!;
      title.w = 24;
      title.h = 4;
      place(title, 2, 2);

      if (unplacedSubtitles.length > 0) {
        const sub = unplacedSubtitles.shift()!;
        sub.w = 20;
        sub.h = 3;
        place(sub, 2, 6);
      }
    }

    if (unplacedPalettes.length > 0) {
      const pal = unplacedPalettes.shift()!;
      pal.w = 16;
      pal.h = 4;
      // Position palette in harmonic top-right corner
      place(pal, COLS - 18, 2);
    }

    // 2. ENGINE SPECIFIC PARTITIONING
    switch (engineType) {
      case 'editorial': {
        // ENGINE 3: Editorial Hero Spread (60/40 Golden Ratio)
        // 28-column hero visual anchor + 40% dedicated typography/spec zone
        const heroLeft = pageSeed % 2 === 0;
        const heroX = heroLeft ? 2 : 18;
        const sideX = heroLeft ? 32 : 2;

        if (unplacedVisuals.length > 0 && isHeroPage) {
          const hero = unplacedVisuals.shift()!;
          hero.w = 28;
          hero.h = rows - 6;
          place(hero, heroX, 2);
        }

        // Place Quotes / Specs in side 40% zone
        if (unplacedQuotes.length > 0) {
          const q = unplacedQuotes.shift()!;
          q.w = 14;
          q.h = 8;
          place(q, sideX, 2);
        }
        if (unplacedSpecs.length > 0) {
          const sp = unplacedSpecs.shift()!;
          sp.w = 14;
          sp.h = 10;
          place(sp, sideX, 11);
        }
        break;
      }

      case 'swiss': {
        // ENGINE 2: Swiss Strict 3-Column Modernist
        // 3 equal 14-column columns, 2-column mathematical gutters (x = 2, 18, 34)
        const colX = [2, 18, 34];
        let currentCol = 0;

        // Place visuals with baseline-aligned heights
        while (unplacedVisuals.length > 0 && currentCol < 3) {
          const vis = unplacedVisuals.shift()!;
          const prof = profiles.get(vis.content);
          vis.w = 14;
          vis.h = prof && prof.ar > 1.2 ? 10 : 16; // strict baseline alignment
          const x = colX[currentCol % 3];
          if (!place(vis, x, 8)) {
            place(vis);
          }
          currentCol++;
        }
        break;
      }

      case 'dual': {
        // ENGINE 4: Dual Feature Balance
        // Paired 22-column symmetric frames (x = 2, w = 22 and x = 24, w = 22)
        if (unplacedVisuals.length >= 2) {
          const leftVis = unplacedVisuals.shift()!;
          const rightVis = unplacedVisuals.shift()!;
          leftVis.w = 21;
          leftVis.h = rows - 8;
          rightVis.w = 21;
          rightVis.h = rows - 8;
          place(leftVis, 2, 6);
          place(rightVis, 25, 6);
        }
        break;
      }

      case 'bento':
      default: {
        // ENGINE 1: Pinterest Bento (Aspect-Ratio Aware Masonry)
        // Hero slot (28×20) to primary image + Portrait Pairing + Landscape Stacking
        if (unplacedVisuals.length > 0 && isHeroPage) {
          const hero = unplacedVisuals.shift()!;
          const prof = profiles.get(hero.content);
          hero.w = prof && prof.ar < 1 ? 24 : 28;
          hero.h = prof && prof.ar < 1 ? 22 : 18;
          place(hero, pageSeed % 2 === 0 ? 2 : 18, 7);
        }

        // Portrait Pairing rule: pairing two portraits side-by-side (24+24 or 16+16)
        const portraits = unplacedVisuals.filter(v => {
          const p = profiles.get(v.content);
          return p && (p.orientation === 'portrait' || p.orientation === 'super-tall');
        });
        if (portraits.length >= 2) {
          const p1 = portraits[0];
          const p2 = portraits[1];
          unplacedVisuals.splice(unplacedVisuals.indexOf(p1), 1);
          unplacedVisuals.splice(unplacedVisuals.indexOf(p2), 1);
          p1.w = 16; p1.h = 16;
          p2.w = 16; p2.h = 16;
          if (!place(p1)) place(p1);
          if (!place(p2)) place(p2);
        }

        // Landscape Stacking rule: stacking two landscapes vertically (16+16 rows)
        const landscapes = unplacedVisuals.filter(v => {
          const p = profiles.get(v.content);
          return p && (p.orientation === 'landscape' || p.orientation === 'panoramic');
        });
        if (landscapes.length >= 2) {
          const l1 = landscapes[0];
          const l2 = landscapes[1];
          unplacedVisuals.splice(unplacedVisuals.indexOf(l1), 1);
          unplacedVisuals.splice(unplacedVisuals.indexOf(l2), 1);
          l1.w = 20; l1.h = 10;
          l2.w = 20; l2.h = 10;
          place(l1);
          place(l2);
        }
        break;
      }
    }

    // 3. PACK REMAINING VISUALS (Aspect-Ratio Aware Fitting)
    for (let i = 0; i < unplacedVisuals.length; i++) {
      const vis = unplacedVisuals[i];
      const prof = profiles.get(vis.content);

      let w = 16;
      let h = 14;
      if (prof) {
        if (prof.orientation === 'super-tall') { w = 12; h = 18; }
        else if (prof.orientation === 'portrait') { w = 14; h = 16; }
        else if (prof.orientation === 'landscape') { w = 22; h = 12; }
        else if (prof.orientation === 'panoramic') { w = 28; h = 10; }
        else { w = 16; h = 14; }
      }

      const blockToPlace = { ...vis, w, h };
      if (place(blockToPlace)) {
        unplacedVisuals.splice(i, 1);
        i--;
      }
    }

    // 4. PACK REMAINING EDITORIAL BLOCKS (Cards, Quotes, Specs, Tags, Texts)
    for (let i = 0; i < unplacedSpecs.length; i++) {
      const sp = { ...unplacedSpecs[i], w: 18, h: 10 };
      if (place(sp)) { unplacedSpecs.splice(i, 1); i--; }
    }

    for (let i = 0; i < unplacedQuotes.length; i++) {
      const q = { ...unplacedQuotes[i], w: 20, h: 8 };
      if (place(q)) { unplacedQuotes.splice(i, 1); i--; }
    }

    for (let i = 0; i < unplacedTags.length; i++) {
      const tg = { ...unplacedTags[i], w: 18, h: 4 };
      if (place(tg)) { unplacedTags.splice(i, 1); i--; }
    }

    for (let i = 0; i < unplacedTexts.length; i++) {
      const tx = { ...unplacedTexts[i], w: 18, h: 5 };
      if (place(tx)) { unplacedTexts.splice(i, 1); i--; }
    }

    for (let i = 0; i < unplacedDividers.length; i++) {
      const div = { ...unplacedDividers[i], w: 24, h: 1 };
      if (place(div)) { unplacedDividers.splice(i, 1); i--; }
    }

    // Push the resolved page
    generatedPages.push({
      id: uid(),
      projectId: 'active',
      order: pageIdx,
      blocks: pageBlocks,
    });

    // If all queues are empty, we don't need to generate more blank pages
    if (
      unplacedVisuals.length === 0 &&
      unplacedQuotes.length === 0 &&
      unplacedSpecs.length === 0 &&
      unplacedTexts.length === 0 &&
      unplacedTags.length === 0
    ) {
      break;
    }
  }

  return generatedPages;
}
