/* Ironstone extension background worker.
 *
 * Owns the pending-save queue in chrome.storage.local. Saves are stored as
 * data URLs so the web app never has to re-fetch cross-origin images; the
 * sync content script on the Ironstone origin hands them to the app, which
 * acknowledges them here for cleanup.
 */

const PENDING_KEY = 'pendingSaves';
const TARGETS_KEY = 'targetsCache';

async function getPending() {
  const data = await chrome.storage.local.get(PENDING_KEY);
  return data[PENDING_KEY] ?? [];
}

async function setPending(saves) {
  await chrome.storage.local.set({ [PENDING_KEY]: saves });
  updateBadge(saves.length);
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#F5711F' });
}

async function fetchAsDataUrl(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('not an image');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case 'save': {
        const { imageUrl, targetType, targetId } = message;
        const dataUrl = await fetchAsDataUrl(imageUrl);
        const pending = await getPending();
        pending.push({
          tempId: crypto.randomUUID(),
          dataUrl,
          targetType,
          targetId,
          savedAt: Date.now(),
        });
        await setPending(pending);
        return { ok: true, pending: pending.length };
      }
      case 'getPending': {
        return { saves: await getPending() };
      }
      case 'clearSynced': {
        const ids = new Set(message.tempIds ?? []);
        const pending = await getPending();
        await setPending(pending.filter((s) => !ids.has(s.tempId)));
        return { ok: true };
      }
      case 'setTargets': {
        await chrome.storage.local.set({
          [TARGETS_KEY]: { ...message.targets, updatedAt: Date.now() },
        });
        return { ok: true };
      }
      case 'getTargets': {
        const data = await chrome.storage.local.get(TARGETS_KEY);
        return { targets: data[TARGETS_KEY] ?? null };
      }
      default:
        return { ok: false };
    }
  })()
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }));
  return true; // async response
});

chrome.runtime.onInstalled.addListener(async () => {
  updateBadge((await getPending()).length);
});
chrome.runtime.onStartup?.addListener(async () => {
  updateBadge((await getPending()).length);
});
