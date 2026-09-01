/* Ironstone extension sync bridge.
 *
 * Runs on the Ironstone web app origin. Relays pending saves from
 * chrome.storage.local to the page (IndexedDB import happens there), relays
 * acknowledgements back, and caches the app's projects/style groups so the
 * popup can offer them as targets even when the app is closed.
 *
 * Payloads cross the isolated-world boundary as JSON strings (safe in Chrome).
 */

function send(type, detail) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...detail }, (response) => {
      void chrome.runtime.lastError; // swallow "receiver closed" noise
      resolve(response ?? null);
    });
  });
}

async function pushPendingSaves() {
  const response = await send('getPending');
  const saves = response?.saves ?? [];
  if (saves.length > 0) {
    window.dispatchEvent(
      new CustomEvent('ironstone:pending-saves', { detail: JSON.stringify({ saves }) }),
    );
  }
}

function requestTargets() {
  window.dispatchEvent(new CustomEvent('ironstone:request-targets'));
}

window.addEventListener('ironstone:sync-complete', (event) => {
  let tempIds = event.detail?.tempIds;
  if (typeof event.detail === 'string') {
    try {
      tempIds = JSON.parse(event.detail).tempIds;
    } catch {
      return;
    }
  }
  if (Array.isArray(tempIds) && tempIds.length > 0) {
    send('clearSynced', { tempIds });
  }
});

window.addEventListener('ironstone:targets', (event) => {
  let targets = event.detail;
  if (typeof event.detail === 'string') {
    try {
      targets = JSON.parse(event.detail);
    } catch {
      return;
    }
  }
  if (targets && Array.isArray(targets.projects) && Array.isArray(targets.styleGroups)) {
    send('setTargets', { targets });
  }
});

window.addEventListener('ironstone:app-ready', () => {
  pushPendingSaves();
  requestTargets();
});

// Also try immediately in case the app booted before this script attached.
if (document.readyState !== 'loading') {
  setTimeout(() => {
    pushPendingSaves();
    requestTargets();
  }, 500);
}
