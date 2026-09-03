import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { ExportPayload } from '../lib/types';
import { rowsFor } from '../lib/grid';
import GridSurface, { blockStyle } from '../editor/GridSurface';
import BlockStatic from '../editor/BlockStatic';

/**
 * Hidden, Puppeteer-only route. Receives a job id + signed token, pulls the
 * transient export payload from the backend, and renders the exact document
 * across multiple physical/digital formats with print CSS.
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
    // 1. Direct injection from Puppeteer (fastest, zero network roundtrip)
    if ((window as any).__EXPORT_PAYLOAD__) {
      setPayload((window as any).__EXPORT_PAYLOAD__);
      return;
    }

    // 2. Fetch from backend URL (fallback)
    const meta = (import.meta as any).env;
    const apiBase = params.get('api') || ((meta?.VITE_API_URL as string) || '').replace(/\/$/, '');
    fetch(`${apiBase}/export/payload/${jobId}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`payload ${res.status}`);
        return (await res.json()) as ExportPayload;
      })
      .then(setPayload)
      .catch((e) => setError(String(e)));
  }, [jobId, token, params]);

  // Wait for all web fonts and images to load completely before signaling ready.
  useEffect(() => {
    if (!payload) return;
    let cancelled = false;

    const waitForResources = async () => {
      // 1. Wait for document web fonts to finish loading
      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch {
          // Font load error fallback
        }
      }

      // 2. Wait for all <img> tags to complete
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('[data-print-block] img'));
      if (imgs.length > 0) {
        await Promise.all(
          imgs.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            });
          })
        );
      }

      // Micro stabilization delay for layout reflow
      await new Promise((r) => setTimeout(r, 120));

      if (!cancelled) {
        setReady(true);
      }
    };

    waitForResources();

    // Safety net: never hang the renderer indefinitely
    const t = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 15000);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payload]);

  if (error) {
    return (
      <div data-render-ready="true" data-render-error={error} style={{ fontFamily: 'Manrope, sans-serif', padding: 40 }}>
        Export render failed: {error}
      </div>
    );
  }
  if (!payload) {
    return <p style={{ fontFamily: 'Manrope, sans-serif', padding: 40 }}>Preparing document…</p>;
  }

  // Multi-format support: A4 Landscape, A4 Portrait, and 16:9 Presentation Deck
  const format = payload.format || (payload.project.orientation === 'portrait' ? 'a4-portrait' : 'a4-landscape');
  const isScreen = format === 'screen-16-9';
  const isPortrait = format === 'a4-portrait';
  const orientation = isPortrait ? 'portrait' : 'landscape';
  const rows = rowsFor(orientation);

  let pageW = '297mm';
  let pageH = '210mm';
  let pageSizeCss = '297mm 210mm';

  if (isPortrait) {
    pageW = '210mm';
    pageH = '297mm';
    pageSizeCss = '210mm 297mm';
  } else if (isScreen) {
    pageW = '1920px';
    pageH = '1080px';
    pageSizeCss = '1920px 1080px';
  }

  const imageMap = new Map(payload.images.map((i) => [i.id, i.dataUrl]));
  const styles = payload.styles || payload.project.styles;

  return (
    <>
      <style>{`
        @page {
          size: ${pageSizeCss};
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-page {
            page-break-after: always;
            break-after: page;
          }
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
        html, body {
          margin: 0;
          padding: 0;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-page {
          width: ${pageW};
          height: ${pageH};
          overflow: hidden;
          position: relative;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
      <div data-render-ready={ready ? 'true' : 'false'} data-project-id={projectId}>
        {payload.pages.map((page) => (
          <div key={page.id} className="print-page" data-print-block>
            <GridSurface
              orientation={orientation}
              styles={styles}
              style={{ width: '100%', height: '100%', aspectRatio: 'auto', boxShadow: 'none' }}
              showGridOverlay={false}
            >
              {page.blocks.map((b) => (
                <div key={b.id} style={blockStyle(b, rows)}>
                  <BlockStatic
                    block={b}
                    imageUrl={(b.type === 'image' || b.type === 'card') ? imageMap.get(b.content) ?? null : null}
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
