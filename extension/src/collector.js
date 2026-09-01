/* Injected on demand into the active tab to list candidate images.
 * Kept dependency-free; executed via chrome.scripting.executeScript.
 */
function ironstoneCollectImages() {
  const seen = new Set();
  const out = [];
  const imgs = Array.from(document.images || []);
  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src || seen.has(src)) continue;
    if (src.startsWith('data:') && src.length < 10000) continue; // skip tiny inline icons
    const w = img.naturalWidth || 0;
    const h = img.naturalHeight || 0;
    if ((w > 0 && w < 150) || (h > 0 && h < 150)) continue; // skip icons/avatars
    seen.add(src);
    out.push({ src, width: w, height: h });
    if (out.length >= 30) break;
  }
  // Pinterest-style srcsets sometimes hide larger versions — prefer the last candidate.
  return out.map((item) => {
    const img = Array.from(document.images).find((i) => (i.currentSrc || i.src) === item.src);
    const srcset = img?.srcset;
    if (srcset) {
      const candidates = srcset
        .split(',')
        .map((s) => s.trim().split(' '))
        .filter((parts) => parts[0]);
      const last = candidates[candidates.length - 1];
      if (last) item.src = last[0];
    }
    return item;
  });
}

ironstoneCollectImages();
