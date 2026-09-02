import type { Block, ImageRec, Page } from './types';
import { COLS } from './grid';

export interface ImageProfile {
  id: string; // The block ID or image ID
  w: number;
  h: number;
  ar: number;
  orientation: 'super-tall' | 'portrait' | 'square' | 'landscape' | 'panoramic';
}

export type LayoutEngineType = 'bento' | 'swiss' | 'editorial' | 'dual';

export async function extractProfiles(images: ImageRec[]): Promise<Map<string, ImageProfile>> {
  const map = new Map<string, ImageProfile>();
  
  const promises = images.map((img) => {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(img.blob);
      const image = new Image();
      image.onload = () => {
        const w = image.naturalWidth;
        const h = image.naturalHeight;
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
        map.set(img.id, { id: img.id, w: 1, h: 1, ar: 1, orientation: 'square' });
        URL.revokeObjectURL(url);
        resolve();
      };
      image.src = url;
    });
  });
  
  await Promise.all(promises);
  return map;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// -------------------------------------------------------------------------
// Layout Engines
// -------------------------------------------------------------------------

export async function applyAutoLayout(
  engineType: LayoutEngineType,
  blocks: Block[],
  images: ImageRec[],
  rows: number
): Promise<Page[]> {
  const pageImageIds = new Set(blocks.filter(b => b.type === 'image' && b.content).map(b => b.content));
  const pageBlobs = images.filter(img => pageImageIds.has(img.id));
  const profiles = await extractProfiles(pageBlobs);

  const imageBlocks = blocks.filter(b => b.type === 'image' && b.content);
  const textBlocks = blocks.filter(b => b.type === 'title' || b.type === 'subtitle' || b.type === 'text' || b.type === 'caption');
  const cardBlocks = blocks.filter(b => b.type === 'card' || b.type === 'quote' || b.type === 'specSheet' || b.type === 'moodTag');
  const paletteBlocks = blocks.filter(b => b.type === 'palette');
  const dividerBlocks = blocks.filter(b => b.type === 'divider');
  
  // Sort images by visual mass
  imageBlocks.sort((a, b) => {
    const profA = profiles.get(a.content);
    const profB = profiles.get(b.content);
    const massA = profA ? profA.w * profA.h : 0;
    const massB = profB ? profB.w * profB.h : 0;
    return massB - massA;
  });
  
  const pages: Page[] = [];
  let currentImages = [...imageBlocks];
  let pageIndex = 0;

  // Track the rest
  const remainingTexts = [...textBlocks];
  const remainingCards = [...cardBlocks];
  const remainingPalettes = [...paletteBlocks];
  const remainingDividers = [...dividerBlocks];

  while (currentImages.length > 0 || pageIndex === 0) {
    const pageBlocks: Block[] = [];
    const grid = Array.from({ length: rows }, () => Array(COLS).fill(false));
    
    // Check if free
    const isFree = (bx: number, by: number, bw: number, bh: number) => {
      if (bx + bw > COLS || by + bh > rows) return false;
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          if (grid[y][x]) return false;
        }
      }
      return true;
    };

    // Mark occupied
    const occupy = (bx: number, by: number, bw: number, bh: number) => {
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          grid[y][x] = true;
        }
      }
    };

    const placeBlock = (b: Block, preferredX?: number, preferredY?: number) => {
      // If preferred coordinates are given and free, use them
      if (preferredX !== undefined && preferredY !== undefined) {
        if (isFree(preferredX, preferredY, b.w, b.h)) {
          b.x = preferredX; b.y = preferredY;
          pageBlocks.push(b);
          occupy(b.x, b.y, b.w, b.h);
          return true;
        }
      }
      
      let placed = false;
      for (let y = 0; y <= rows - b.h; y++) {
        for (let x = 0; x <= COLS - b.w; x++) {
          if (isFree(x, y, b.w, b.h)) {
            b.x = x; b.y = y;
            pageBlocks.push(b);
            occupy(b.x, b.y, b.w, b.h);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      return placed;
    };

    // 1. Negative Space Reservation (for Page 0 only usually, or every page)
    if (pageIndex === 0) {
      // Title block top-left (24x6)
      const titles = remainingTexts.filter(b => b.type === 'title');
      if (titles.length > 0) {
        const t = titles[0];
        placeBlock({ ...t, w: 24, h: 6 }, 2, 2);
        remainingTexts.splice(remainingTexts.indexOf(t), 1);
      }
      
      // Palette top-right (16x4)
      if (remainingPalettes.length > 0) {
        const p = remainingPalettes[0];
        placeBlock({ ...p, w: 16, h: 4 }, COLS - 16 - 2, 2);
        remainingPalettes.splice(0, 1);
      }
    }

    let heroCount = engineType === 'dual' ? 2 : (engineType === 'swiss' ? 0 : 1);
    let placedInThisPage = 0;
    
    // We can randomize layout or place deterministically
    for (let i = 0; i < currentImages.length; i++) {
      const imgBlock = currentImages[i];
      const prof = profiles.get(imgBlock.content);
      if (!prof) continue;

      let w = 16, h = 16;
      let preferredX, preferredY;

      if (i < heroCount && pageIndex === 0) {
        // Hero
        if (engineType === 'editorial') {
          w = 28; h = rows - 4; // 60/40 spread
          preferredX = 2; preferredY = 2;
        } else if (engineType === 'dual') {
          w = 20; h = 24;
          if (i === 0) { preferredX = 2; preferredY = 4; }
          if (i === 1) { preferredX = COLS - 22; preferredY = 4; }
        } else if (engineType === 'bento') {
          w = prof.ar < 1 ? 24 : 28;
          h = prof.ar < 1 ? 24 : 20;
          // place on left or right randomly? we'll let packer find first slot
        }
      } else {
        if (engineType === 'swiss') {
          // 3 equal 14-column columns, 2 col gutters.
          // columns at: x=2, x=18, x=34
          w = 14; 
          h = prof.ar < 1 ? 20 : 12; // Adjust height based on aspect ratio
        } else {
          // Bento or other
          if (prof.orientation === 'super-tall' || prof.orientation === 'portrait') {
            w = 16; h = 20;
          } else if (prof.orientation === 'landscape' || prof.orientation === 'panoramic') {
            w = 24; h = 16;
          } else {
            w = 16; h = 16;
          }
        }
      }

      const copy = { ...imgBlock, w, h };
      if (placeBlock(copy, preferredX, preferredY)) {
        placedInThisPage++;
        currentImages.splice(i, 1);
        i--;
      }
    }

    // Place remaining blocks
    for (let i = 0; i < remainingTexts.length; i++) {
      if (placeBlock({ ...remainingTexts[i], w: 20, h: 4 })) {
        remainingTexts.splice(i, 1); i--;
      }
    }
    for (let i = 0; i < remainingCards.length; i++) {
      if (placeBlock({ ...remainingCards[i], w: 16, h: 10 })) {
        remainingCards.splice(i, 1); i--;
      }
    }
    for (let i = 0; i < remainingDividers.length; i++) {
      if (placeBlock({ ...remainingDividers[i], w: 24, h: 1 })) {
        remainingDividers.splice(i, 1); i--;
      }
    }
    for (let i = 0; i < remainingPalettes.length; i++) {
      if (placeBlock({ ...remainingPalettes[i], w: 16, h: 4 })) {
        remainingPalettes.splice(i, 1); i--;
      }
    }

    pages.push({
      id: generateId(),
      projectId: 'temp', // will be overwritten in Editor
      blocks: pageBlocks,
      order: pageIndex
    });

    pageIndex++;
    if (placedInThisPage === 0 && currentImages.length > 0) {
      // Failsafe: if we couldn't place ANY image, force size down
      currentImages[0].w = Math.max(4, currentImages[0].w - 4);
      currentImages[0].h = Math.max(4, currentImages[0].h - 4);
      // Let it loop again
    }
    if (pageIndex > 10) break; // Hard limit for safety
  }

  return pages;
}
