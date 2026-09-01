import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { getProject, getSettings, listPages, listProjectImages, saveEmail } from '../db/repo';
import { blobToDataUrl } from '../lib/images';
import { getExportStatus, startExport } from '../lib/api';
import type { ExportPayload } from '../lib/types';

type Phase =
  | { kind: 'email' }
  | { kind: 'submitting' }
  | { kind: 'processing'; jobId: string; note?: string }
  | { kind: 'done'; emailed: boolean }
  | { kind: 'failed'; message: string };

export default function Export() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'email' });
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    getProject(id).then((p) => setProjectName(p?.name ?? ''));
    listPages(id).then((pages) => {
      setHasContent(pages.length > 0);
    });
    getSettings().then((s) => {
      setSaved(s.savedEmail);
      if (s.savedEmail) setEmail(s.savedEmail);
    });
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [id]);

  async function buildPayload(withEmail: boolean): Promise<ExportPayload> {
    const project = (await getProject(id))!;
    const pages = await listPages(id);
    const images = await listProjectImages(id);
    return {
      project,
      pages,
      images: await Promise.all(
        images.map(async (img) => ({ id: img.id, dataUrl: await blobToDataUrl(img.blob) })),
      ),
      palette: project.palette ?? [],
      email: withEmail && email.trim() ? email.trim() : undefined,
    };
  }

  async function submit(withEmail: boolean) {
    if (withEmail && !/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setPhase({ kind: 'submitting' });
    try {
      if (withEmail) await saveEmail(email.trim());
      const payload = await buildPayload(withEmail);
      const { jobId } = await startExport(payload);
      setPhase({ kind: 'processing', jobId });
      poll(jobId, withEmail);
    } catch (err) {
      setPhase({
        kind: 'failed',
        message: err instanceof Error ? err.message : 'PDF generation failed. Try again.',
      });
    }
  }

  function poll(jobId: string, expectsEmail: boolean) {
    const tick = async () => {
      try {
        const status = await getExportStatus(jobId);
        if (status.status === 'done') {
          if (!status.emailed && status.downloadUrl) {
            // Absolute URL ensures the browser actually downloads the file
            const a = document.createElement('a');
            a.href = `http://localhost:4100${status.downloadUrl}`;
            a.download = `${projectName || 'moodboard'}.pdf`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          if (!status.emailed) navigate(`/projects/${id}?exportSuccess=download`); else navigate(`/projects/${id}?exportSuccess=email`);
          return;
        }
        if (status.status === 'failed') {
          setPhase({ kind: 'failed', message: status.error || 'PDF generation failed. Try again.' });
          return;
        }
        setPhase({
          kind: 'processing',
          jobId,
          note: status.status === 'queued' ? 'Waiting for the renderer…' : 'Preparing your PDF…',
        });
        pollRef.current = window.setTimeout(tick, 1500);
      } catch {
        // Transient network hiccup — keep polling; Render free tier cold-starts.
        pollRef.current = window.setTimeout(tick, 2500);
      }
    };
    void tick();
    void expectsEmail;
  }

  return (
    <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
      <Link to={`/projects/${id}/editor`} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-ink mb-6">
        <div className="flex items-center justify-center w-5 h-5 shrink-0"><ArrowLeft size={16} strokeWidth={1.5} /></div> Back to editor
      </Link>

      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink mb-8">Export moodboard</h1>

      {hasContent === false ? (
        /* Empty / Warning state when project has 0 pages */
        <div className="card p-10 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-text-muted">
            <AlertCircle size={22} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">This project has no content to export</h2>
            <p className="mt-1 text-sm text-text-muted max-w-sm">
              Add at least one image or layout page before generating a PDF moodboard.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Link to={`/projects/${id}/editor`} className="btn-primary">
              Back to Editor
            </Link>
            <Link to={`/projects/${id}`} className="btn-secondary">
              Go to Collection
            </Link>
          </div>
        </div>
      ) : (
        <>
          {phase.kind === 'email' && (
            <div className="card p-6 space-y-5">
              {saved ? (
                <p className="text-sm text-text-muted">
                  Send the PDF to your saved email <span className="font-semibold text-ink">{saved}</span>,
                  or enter a different one below.
                </p>
              ) : (
                <p className="text-sm text-text-muted">
                  The PDF downloads right here when it’s ready. Add an email and we’ll also send
                  it to you — handy if rendering takes a moment.
                </p>
              )}
              <div>
                <label className="label" htmlFor="email">
                  Email (optional)
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="you@studio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => submit(false)}>
                  Download only
                </button>
                <button
                  className="btn-primary"
                  disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
                  onClick={() => submit(true)}
                >
                  Export{email.trim() ? ' & email' : ''}
                </button>
              </div>
            </div>
          )}

          {(phase.kind === 'submitting' || phase.kind === 'processing') && (
            <div className="card p-8 text-center">
              <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-[1.5px] border-surface-active border-t-accent" />
              <p className="font-semibold">
                {phase.kind === 'submitting'
                  ? 'Submitting…'
                  : (phase.note ?? 'Preparing your PDF…')}
              </p>
              <p className="mt-1 text-sm text-text-muted">This may take a moment.</p>
            </div>
          )}

          {phase.kind === 'done' && (
            <div className="card p-8 text-center space-y-3">
              <div className="mx-auto flex items-center justify-center w-12 h-12 shrink-0">
                <CheckCircle2 className="text-accent" size={32} strokeWidth={1.5} />
              </div>
              <p className="font-semibold text-lg">
                {phase.emailed ? 'Your PDF is on its way' : 'Your PDF has downloaded'}
              </p>
              <p className="text-sm text-text-muted">
                {phase.emailed
                  ? `We sent the moodboard to ${email}. Check your inbox in a minute.`
                  : 'Check your downloads folder.'}
              </p>
              <div className="pt-2">
                <Link to={`/projects/${id}`} className="btn-secondary">
                  Back to project
                </Link>
              </div>
            </div>
          )}

          {phase.kind === 'failed' && (
            <div className="card p-6 space-y-4">
              <div className="rounded-md bg-accent-soft px-4 py-3 text-sm">
                <p className="font-semibold">PDF generation failed.</p>
                <p className="mt-0.5 text-text-muted">{phase.message}</p>
              </div>
              <div className="flex justify-end">
                <button className="btn-primary" onClick={() => setPhase({ kind: 'email' })}>
                  Try again
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
