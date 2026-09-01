import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';

export const pinterestRouter = Router();

const API = 'https://api.pinterest.com/v5';

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function pinterestFetch(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${config.pinterestAccessToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('Pinterest authentication failed. Check the server access token.'), { status: 502 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Pinterest API error (${res.status})`), { status: 502 });
  }
  return res.json();
}

/** Resolve a board URL (pinterest.com/<user>/<board>/) to a board id. */
async function resolveBoardId(boardUrl) {
  const u = new URL(boardUrl);
  const segments = u.pathname.split('/').filter(Boolean);
  if (segments.length < 2) throw Object.assign(new Error('Invalid board URL'), { status: 400 });
  const wanted = slugify(segments[1]);
  let bookmark = null;
  for (let page = 0; page < 10; page++) {
    const data = await pinterestFetch(`/boards?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ''}`);
    const boards = data.items ?? [];
    const match = boards.find((b) => slugify(b.name ?? '') === wanted);
    if (match) return match.id;
    bookmark = data.bookmark;
    if (!bookmark) break;
  }
  throw Object.assign(new Error('Board not found on the connected Pinterest account.'), { status: 404 });
}

function pinToImage(pin) {
  const images = pin?.media?.images ?? {};
  const best =
    images.originals?.url ??
    images['1200x']?.url ??
    images['600x']?.url ??
    pin?.image_cover_url ??
    null;
  if (!best) return null;
  return {
    id: String(pin.id),
    title: pin.title ?? pin.description?.slice(0, 120) ?? '',
    imageUrl: best,
    link: pin.link ?? null,
  };
}

const importSchema = z.object({ boardUrl: z.string().url().max(500) });

pinterestRouter.get('/api/pinterest/board', async (req, res) => {
  if (!config.pinterestAccessToken) {
    return res.status(503).json({
      error: 'Pinterest import is not configured on this server (missing PINTEREST_ACCESS_TOKEN).',
    });
  }
  const parsed = importSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'A valid Pinterest board URL is required.' });
  if (!/(^|\.)pinterest\./.test(new URL(parsed.data.boardUrl).hostname)) {
    return res.status(400).json({ error: 'That URL is not a Pinterest board.' });
  }
  try {
    const boardId = await resolveBoardId(parsed.data.boardUrl);
    const pins = []; const seen = new Set();
    let bookmark = null;
    for (let page = 0; page < 4 && pins.length < 100; page++) {
      const data = await pinterestFetch(
        `/boards/${boardId}/pins?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ''}`,
      );
      for (const pin of data.items ?? []) {
        const img = pinToImage(pin);
        if (img && !seen.has(img.imageUrl)) { seen.add(img.imageUrl); pins.push(img); }
      }
      bookmark = data.bookmark;
      if (!bookmark) break;
    }
    res.json({ pins });
  } catch (err) {
    res.status(err.status ?? 502).json({ error: err.message ?? 'Pinterest import failed.' });
  }
});

/**
 * Image proxy so the frontend can store Pinterest images without CORS issues.
 * Restricted to Pinterest's image CDN.
 */
pinterestRouter.get('/api/pinterest/image', async (req, res) => {
  const url = req.query.url?.toString() ?? '';
  let u;
  try {
    u = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid image URL.' });
  }
  if (!/(^|\.)pinimg\.com$/.test(u.hostname)) {
    return res.status(400).json({ error: 'Only Pinterest image URLs are allowed.' });
  }
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(502).json({ error: 'Image fetch failed.' });
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).json({ error: 'Image fetch failed.' });
  }
});

