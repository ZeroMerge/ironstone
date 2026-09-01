import { useEffect, useState } from 'react';
import { getImage } from '../db/repo';

const urlCache = new Map<string, string>();

export function objectUrlFor(imageId: string, blob: Blob): string {
  const cached = urlCache.get(imageId);
  if (cached) return cached;
  const url = URL.createObjectURL(blob);
  urlCache.set(imageId, url);
  return url;
}

/** Hook: resolves an imageId from IndexedDB to an object URL. */
export function useImageUrl(imageId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    imageId ? urlCache.get(imageId) ?? null : null,
  );
  useEffect(() => {
    let cancelled = false;
    if (!imageId) {
      setUrl(null);
      return;
    }
    if (urlCache.has(imageId)) {
      setUrl(urlCache.get(imageId)!);
      return;
    }
    getImage(imageId).then((rec) => {
      if (!cancelled && rec) setUrl(objectUrlFor(rec.id, rec.blob));
    });
    return () => {
      cancelled = true;
    };
  }, [imageId]);
  return url;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

const MAX_DIMENSION = 1600;

/**
 * Downscales an image blob for storage so IndexedDB stays lean and PDF exports
 * remain high quality (1600px on the long edge is plenty for a grid block).
 */
export async function normalizeImage(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith('image/')) throw new Error('Not an image');
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  if (scale === 1) {
    bitmap.close();
    return blob;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.88),
  );
  return out ?? blob;
}
