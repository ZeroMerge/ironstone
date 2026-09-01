/**
 * Deterministic palette extraction: sample pixels on a small canvas, bucket
 * into a uniform 4-bit/channel color cube, rank by frequency, then pick the
 * top N perceptually-distinct colors. No randomness, no AI.
 */

function dist2(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function toHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

async function samplePixels(blob: Blob): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob);
  const size = 48; // 48×48 sample per image
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return ctx.getImageData(0, 0, size, size).data;
}

export async function extractPalette(blobs: Blob[], count = 6): Promise<string[]> {
  const buckets = new Map<number, { rgb: [number, number, number]; n: number }>();

  for (const blob of blobs.slice(0, 24)) {
    try {
      const data = await samplePixels(blob);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 128) continue;
        // Skip near-white / near-black noise so the palette stays colorful.
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max > 245 && min > 245) continue;
        if (max < 12) continue;
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const center: [number, number, number] = [
          ((r >> 4) << 4) + 8,
          ((g >> 4) << 4) + 8,
          ((b >> 4) << 4) + 8,
        ];
        const existing = buckets.get(key);
        if (existing) existing.n += 1;
        else buckets.set(key, { rgb: center, n: 1 });
      }
    } catch {
      // Unreadable image — skip it, palette just uses the rest.
    }
  }

  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n);
  const picked: [number, number, number][] = [];
  const MIN_DIST2 = 60 * 60; // perceptual separation threshold
  for (const { rgb } of ranked) {
    if (picked.length >= count) break;
    if (picked.every((p) => dist2(p, rgb) > MIN_DIST2)) picked.push(rgb);
  }
  // Fill up with next-best buckets if separation filtering was too strict.
  for (const { rgb } of ranked) {
    if (picked.length >= count) break;
    if (!picked.includes(rgb)) picked.push(rgb);
  }
  return picked.map(toHex);
}
