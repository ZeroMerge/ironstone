let lastRightClickedImg = null;

document.addEventListener('contextmenu', (e) => {
  if (e.target.tagName === 'IMG') {
    lastRightClickedImg = e.target.currentSrc || e.target.src;
  } else {
    lastRightClickedImg = null;
  }
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectImages') {
    const seen = new Set();
    const out = [];
    
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg && ogImg.content) {
      seen.add(ogImg.content);
      out.push({ src: ogImg.content, width: 800, height: 600 });
    }

    const imgs = Array.from(document.images || []);
    for (const img of imgs) {
      const src = img.currentSrc || img.src;
      if (!src || seen.has(src)) continue;
      if (src.startsWith('data:') && src.length < 10000) continue;
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if ((w > 0 && w < 150) || (h > 0 && h < 150)) continue;
      seen.add(src);
      out.push({ src, width: w, height: h });
      if (out.length >= 50) break;
    }
    sendResponse({ images: out });
  } else if (request.action === 'getSelectedImage') {
    sendResponse({ src: lastRightClickedImg });
  }
});

