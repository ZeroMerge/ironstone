/* Ironstone extension popup.
 *
 * Flow: list candidate images on the active tab (via collector.js) → user
 * picks one → user picks a target (project or style group, from the cached
 * target list the web app pushed) → background worker fetches the image as a
 * data URL and queues it in chrome.storage.local for the next app sync.
 */

const $ = (id) => document.getElementById(id);

function show(id) {
  for (const el of document.querySelectorAll('.notice, #main')) el.classList.add('hidden');
  $(id).classList.remove('hidden');
}

function send(type, detail) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...detail }, (response) => {
      void chrome.runtime.lastError;
      resolve(response ?? null);
    });
  });
}

let images = [];
let selectedSrc = null;

async function collectImages() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url ?? '')) return [];
  try {
    const results = await new Promise(resolve => chrome.tabs.sendMessage(tab.id, { action: 'detectImages' }, response => { void chrome.runtime.lastError; resolve(response?.images || []); }));
    return results;
  } catch {
    return [];
  }
}

function renderGrid() {
  const grid = $('grid');
  grid.textContent = '';
  for (const item of images) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb' + (item.src === selectedSrc ? ' selected' : '');
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = '';
    img.loading = 'lazy';
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      selectedSrc = item.src;
      $('save').disabled = false;
      renderGrid();
    });
    grid.appendChild(btn);
  }
}

function renderTargets(targets) {
  const select = $('target');
  select.textContent = '';
  const addGroup = (label, items, type) => {
    if (items.length === 0) return;
    const og = document.createElement('optgroup');
    og.label = label;
    for (const item of items) {
      const opt = document.createElement('option');
      opt.value = `${type}:${item.id}`;
      opt.textContent = item.name;
      og.appendChild(opt);
    }
    select.appendChild(og);
  };
  addGroup('Projects', targets.projects, 'project');
  
}

async function refreshPendingNote() {
  const res = await send('getPending');
  const n = res?.saves?.length ?? 0;
  const note = $('pending-note');
  if (n > 0) {
    note.textContent = `${n} save${n === 1 ? '' : 's'} waiting to sync into Ironstone.`;
    note.classList.remove('hidden');
  } else {
    note.classList.add('hidden');
  }
}

async function init() {
  const [targetsRes, collected] = await Promise.all([send('getTargets'), collectImages()]);
  const targets = targetsRes?.targets;
  const hasTargets =
    targets && targets.projects?.length > 0;

  if (!hasTargets) {
    show('no-targets');
    return;
  }
  images = collected;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const sel = await new Promise(resolve => chrome.tabs.sendMessage(tab.id, { action: 'getSelectedImage' }, response => { void chrome.runtime.lastError; resolve(response?.src); }));
    if (sel) { selectedSrc = sel; `save.disabled = false; }
  }
  if (images.length === 0) {
    show('empty-images');
    return;
  }
  renderTargets(targets);
  renderGrid();
  show('main');
  refreshPendingNote();
}

$('save').addEventListener('click', async () => {
  if (!selectedSrc) return;
  const btn = $('save');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  const value = $('target').value; // "project:<id>" | "style:<id>"
  const sep = value.indexOf(':');
  const targetType = value.slice(0, sep);
  const targetId = value.slice(sep + 1);
  try {
    const res = await send('save', { imageUrl: selectedSrc, targetType, targetId });
    if (!res?.ok) throw new Error(res?.error ?? 'save failed');
    show('saved');
    refreshPendingNote();
  } catch {
    show('error');
  } finally {
    btn.textContent = 'Save image';
    btn.disabled = false;
  }
});

init();




