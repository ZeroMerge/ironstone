import { putImage } from '../db/repo';
import { dataUrlToBlob, normalizeImage } from './images';
import { listProjects } from '../db/repo';

export interface PendingSave {
  tempId: string;
  dataUrl: string;
  targetType: 'project';
  targetId: string;
  savedAt: number;
}

function parseDetail<T>(detail: unknown): T | null {
  if (detail == null) return null;
  if (typeof detail === 'string') {
    try {
      return JSON.parse(detail) as T;
    } catch {
      return null;
    }
  }
  return detail as T;
}

export function installExtensionSync(onSynced?: () => void): void {
  window.addEventListener('ironstone:pending-saves', async (event) => {
    const saves = parseDetail<{ saves: PendingSave[] }>(
      (event as CustomEvent).detail,
    )?.saves ?? [];
    const done: string[] = [];
    for (const save of saves) {
      try {
        const blob = await normalizeImage(await dataUrlToBlob(save.dataUrl));
        await putImage({ projectId: save.targetType === 'project' ? save.targetId : null, styleGroupId: null, blob, source: 'extension' });
        done.push(save.tempId);
      } catch {}
    }
    if (done.length > 0) {
      window.dispatchEvent(
        new CustomEvent('ironstone:sync-complete', { detail: { tempIds: done } }),
      );
      onSynced?.();
    }
  });

  window.addEventListener('ironstone:request-targets', async () => {
    const projects = await listProjects();
    window.dispatchEvent(
      new CustomEvent('ironstone:targets', {
        detail: {
          projects: projects.map((p) => ({ id: p.id, name: p.name })),
        },
      }),
    );
  });

  window.dispatchEvent(new CustomEvent('ironstone:app-ready'));
}
