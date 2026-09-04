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

/** Resolve a board URL, following redirects for shortlinks (pin.it) if needed */
async function resolveCanonicalBoardUrl(inputUrl) {
  let targetUrl = inputUrl.trim();
  if (targetUrl && !/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }
  try {
    const parsed = new URL(targetUrl);
    if (/(^|\.)pin\.it$/.test(parsed.hostname) || !/(^|\.)pinterest\./.test(parsed.hostname)) {
      const res = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      targetUrl = res.url;
    }
  } catch {
    // keep targetUrl as is
  }

  const u = new URL(targetUrl);
  if (!/(^|\.)pinterest\./.test(u.hostname)) {
    throw Object.assign(new Error('That URL does not point to Pinterest.'), { status: 400 });
  }

  const segments = u.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw Object.assign(
      new Error('Please provide a link to a specific Pinterest board (e.g. pinterest.com/username/board-name).'),
      { status: 400 }
    );
  }

  const username = segments[0];
  const boardSlug = segments[1];
  return {
    canonicalUrl: `https://www.pinterest.com/${username}/${boardSlug}`,
    username,
    boardSlug,
  };
}

/** Extract pins directly from a public board via unescaped RSS feed + React Redux state */
async function extractPublicPins(canonicalUrl) {
  const pins = [];
  const seenImageUrls = new Set();
  const seenPinIds = new Set();

  function addPin(id, title, imgUrl, link) {
    if (!imgUrl || typeof imgUrl !== 'string') return;
    const cleanImg = imgUrl.trim();
    if (!cleanImg.startsWith('http')) return;

    // Normalize and upgrade to original high-res format
    const origUrl = cleanImg.replace(/\/(?:236x|474x|564x|736x|1200x)\//, '/originals/');
    const pinId = String(id || '').trim();

    if (pinId && seenPinIds.has(pinId)) return;
    if (seenImageUrls.has(origUrl) || seenImageUrls.has(cleanImg)) return;

    if (pinId) seenPinIds.add(pinId);
    seenImageUrls.add(origUrl);
    seenImageUrls.add(cleanImg);

    pins.push({
      id: pinId || String(pins.length + 1),
      title: title || '',
      imageUrl: origUrl,
      link: link || canonicalUrl,
    });
  }

  // Strategy 1: Official Board RSS Feed (primary authoritative source for public boards)
  try {
    const rssRes = await fetch(`${canonicalUrl}.rss`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (rssRes.ok) {
      const xml = await rssRes.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemContent = itemMatch[1];
        // Decode XML entities so <img src="..."> can be extracted cleanly
        const unescaped = itemContent
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'");

        const titleMatch = unescaped.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = unescaped.match(/<link>([\s\S]*?)<\/link>/);
        const imgMatch =
          unescaped.match(/<img[^>]+src=["'](https:\/\/i\.pinimg\.com\/[^"']+)["']/i) ||
          itemContent.match(/&lt;img[^>]+src=&quot;(https:\/\/i\.pinimg\.com\/[^&]+)&quot;/i) ||
          unescaped.match(/https:\/\/i\.pinimg\.com\/[^\s"'>\\]+/i);

        const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
        const link = linkMatch ? linkMatch[1].trim() : canonicalUrl;
        const pinId = link.match(/\/pin\/([^\/]+)/)?.[1] || '';
        const imgSrc = imgMatch ? (imgMatch[1] || imgMatch[0]).trim() : null;

        if (imgSrc && imgSrc.startsWith('http')) {
          addPin(pinId, title, imgSrc, link);
        }
      }
    }
  } catch (e) {
    console.warn('[pinterest] RSS feed fetch error:', e.message);
  }

  // Strategy 2: Board Redux State from HTML (__PWS_INITIAL_PROPS__)
  try {
    const htmlRes = await fetch(`${canonicalUrl}/`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const scriptMatch = html.match(/<script id="__PWS_INITIAL_PROPS__"[^>]*>([\s\S]*?)<\/script>/);
      if (scriptMatch) {
        try {
          const json = JSON.parse(scriptMatch[1]);
          const redux = json.initialReduxState || json.props?.initialReduxState;

          // 2a. Extract from BoardFeedResource
          const bfr = redux?.resources?.BoardFeedResource || {};
          for (const key of Object.keys(bfr)) {
            const feedData = bfr[key]?.data;
            if (Array.isArray(feedData)) {
              for (const item of feedData) {
                if (item.story_type === 'related_interests_module' || !item.images) continue;
                const imgs = item.images;
                const bestImg =
                  imgs?.orig?.url ||
                  imgs?.['1200x']?.url ||
                  imgs?.['736x']?.url ||
                  imgs?.['564x']?.url ||
                  imgs?.['236x']?.url;
                if (bestImg) {
                  addPin(
                    item.id,
                    item.grid_title || item.title || item.description,
                    bestImg,
                    `https://www.pinterest.com/pin/${item.id}/`
                  );
                }
              }
            }
          }

          // 2b. Extract from redux.pins
          if (redux?.pins) {
            for (const [pinId, pin] of Object.entries(redux.pins)) {
              if (pin.story_type === 'related_interests_module' || !pin.images) continue;
              const imgs = pin.images;
              const bestImg =
                imgs?.orig?.url ||
                imgs?.['1200x']?.url ||
                imgs?.['736x']?.url ||
                imgs?.['564x']?.url ||
                imgs?.['236x']?.url;
              if (bestImg) {
                addPin(
                  pinId,
                  pin.grid_title || pin.title || pin.description,
                  bestImg,
                  `https://www.pinterest.com/pin/${pinId}/`
                );
              }
            }
          }
        } catch {
          // JSON parse failed
        }
      }
    }
  } catch (e) {
    console.warn('[pinterest] HTML page fetch error:', e.message);
  }

  return pins;
}

/** Resolve a board URL to a board id using official API. */
async function resolveBoardId(boardSlug) {
  const wanted = slugify(boardSlug);
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
  const parsed = importSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'A valid Pinterest board URL is required.' });
  }

  try {
    // 1. Follow shortlinks and normalize board URL
    const { canonicalUrl, boardSlug } = await resolveCanonicalBoardUrl(parsed.data.boardUrl);

    // 2. Primary: Extract from public board (RSS + HTML high-res images)
    const publicPins = await extractPublicPins(canonicalUrl);
    if (publicPins.length > 0) {
      return res.json({ pins: publicPins });
    }

    // 3. Fallback: If public extraction found 0 pins and access token is configured, try official API
    if (config.pinterestAccessToken) {
      try {
        const boardId = await resolveBoardId(boardSlug);
        const pins = [];
        const seen = new Set();
        let bookmark = null;
        for (let page = 0; page < 4 && pins.length < 100; page++) {
          const data = await pinterestFetch(
            `/boards/${boardId}/pins?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ''}`,
          );
          for (const pin of data.items ?? []) {
            const img = pinToImage(pin);
            if (img && !seen.has(img.imageUrl)) {
              seen.add(img.imageUrl);
              pins.push(img);
            }
          }
          bookmark = data.bookmark;
          if (!bookmark) break;
        }
        if (pins.length > 0) {
          return res.json({ pins });
        }
      } catch {
        // official API also failed
      }
    }

    // If nothing found:
    return res.status(404).json({
      error: 'No pins could be found on this board. Make sure the board is public and contains images.',
    });
  } catch (err) {
    res.status(err.status ?? 502).json({ error: err.message ?? 'Pinterest import failed.' });
  }
});

/**
 * Image proxy so the frontend can store Pinterest images without CORS issues.
 * Features automatic resolution fallback (originals -> 1200x -> 736x -> 564x -> 474x -> 236x)
 * because Pinterest CDN returns 403 Forbidden for 'originals' on certain pins.
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

  const candidateSizes = ['originals', '1200x', '736x', '564x', '474x', '236x'];
  const sizeRegex = /\/(?:originals|1200x|736x|564x|474x|236x)\//;
  const urlsToTry = [];

  if (sizeRegex.test(url)) {
    const matchedSize = url.match(sizeRegex)[0].replace(/\//g, '');
    const startIdx = candidateSizes.indexOf(matchedSize);
    const ordered = startIdx >= 0
      ? [...candidateSizes.slice(startIdx), ...candidateSizes.slice(0, startIdx)]
      : candidateSizes;
    for (const size of ordered) {
      urlsToTry.push(url.replace(sizeRegex, `/${size}/`));
    }
  } else {
    urlsToTry.push(url);
  }

  for (const candidate of urlsToTry) {
    try {
      const upstream = await fetch(candidate, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Referer: 'https://www.pinterest.com/',
        },
      });
      if (upstream.ok) {
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        const buffer = Buffer.from(await upstream.arrayBuffer());
        return res.send(buffer);
      }
    } catch {
      // try next candidate resolution
    }
  }

  res.status(502).json({ error: 'Image fetch failed across all resolutions.' });
});

