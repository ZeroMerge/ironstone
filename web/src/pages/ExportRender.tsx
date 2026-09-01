import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { ExportPayload } from '../lib/types';
import { rowsFor } from '../lib/grid';
import GridSurface, { blockStyle } from '../editor/GridSurface';
import BlockStatic from '../editor/BlockStatic';

/**
 * Hidden, Puppeteer-only route. Receives a job id + signed token, pulls the
 * transient export payload from the backend, and renders the exact document
 * at A4 physical size with print CSS. No editor chrome, no navigation.
 *
 * Puppeteer waits for [data-render-ready="true"] before calling page.pdf().
 */
export default function ExportRender() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const [payload, setPayload] = useState<ExportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const jobId = params.get('job') ?? '';
  const token = params.get('token') ?? '';

  useEffect(() => {
    fetch(`/export/payload/${jobId}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`payload ${res.status}`);
        return (await res.json()) as ExportPayload;
      })
      .then(setPayload)
      .catch((e) => setError(String(e)));
  }, [jobId, token]);

  // Signal readiness only after every <img> has loaded.
  useEffect(() => {
    if (!payload) return;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('[data-print-block] img'));
    if (imgs.length === 0) {
      setReady(true);
      return;
    }
    let remaining = imgs.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) setReady(true);
    };
    for (const img of imgs) {
      if (img.complete) done();
      else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    }
    // Safety net: never hang the renderer.
    const t = setTimeout(() => setReady(true), 15000);
    return () => clearTimeout(t);
  }, [payload]);

  if (error) {
    return <p style={{ fontFamily: 'Manrope, sans-serif', padding: 40 }}>Export render failed: {error}</p>;
  }
  if (!payload) {
    return <p style={{ fontFamily: 'Manrope, sans-serif', padding: 40 }}>Preparing document…</p>;
  }

  const orientation = payload.project.orientation;
  const rows = rowsFor(orientation);
  const landscape = orientation === 'landscape';
  const pageW = landscape ? '297mm' : '210mm';
  const pageH = landscape ? '210mm' : '297mm';
  const imageMap = new Map(payload.images.map((i) => [i.id, i.dataUrl]));

  return (
    <>
      <style>{`
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; }
          .print-page { page-break-after: always; break-after: page; }
          .print-page:last-child { page-break-after: auto; break-after: auto; }
        }
        html, body { margin: 0; padding: 0; background: #fff; }
        .print-page {
          width: ${pageW};
          height: ${pageH};
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
      <div data-render-ready={ready ? 'true' : 'false'} data-project-id={projectId}>
        {payload.pages.map((page) => (
          <div key={page.id} className="print-page" data-print-block>
            <GridSurface
              orientation={orientation}
              styles={payload.project.styles}
              style={{ width: '100%', height: '100%', aspectRatio: 'auto' }}
            >
              {page.blocks.map((b) => (
                <div key={b.id} style={blockStyle(b, rows)}>
                  <BlockStatic
                    block={b}
                    imageUrl={b.type === 'image' ? imageMap.get(b.content) ?? null : null}
                  />
                </div>
              ))}
            </GridSurface>
          </div>
        ))}
      </div>
    </>
  );
}
