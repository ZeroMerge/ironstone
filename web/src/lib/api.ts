import type { ExportPayload } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new Error('Could not connect to the export server. Try again.');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ---------- Pinterest ----------

export interface PinterestPin {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
}

export function importPinterestBoard(boardUrl: string): Promise<{ pins: PinterestPin[] }> {
  return request(`/api/pinterest/board?boardUrl=${encodeURIComponent(boardUrl)}`);
}

/** Proxied through the backend so images can be stored without CORS issues. */
export function pinterestImageProxyUrl(imageUrl: string): string {
  return `/api/pinterest/image?url=${encodeURIComponent(imageUrl)}`;
}

// ---------- Export ----------

export interface ExportJob {
  jobId: string;
}

export type ExportStatus =
  | { status: 'queued' | 'processing'; position?: number }
  | { status: 'done'; emailed: boolean; downloadUrl: string | null }
  | { status: 'failed'; error: string };

export function startExport(payload: ExportPayload): Promise<ExportJob> {
  return request('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getExportStatus(jobId: string): Promise<ExportStatus> {
  return request(`/export/status/${jobId}`);
}

