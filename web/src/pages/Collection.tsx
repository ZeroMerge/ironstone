import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Camera, Upload, Compass, Plus, Sparkles } from 'lucide-react';
import {
  deleteProjectPages,
  deleteImage,
  getProject,
  listPages,
  listProjectImages,
  putImage,
  putPage,
} from '../db/repo';
import type { ImageRec, Project } from '../lib/types';
import { normalizeImage, objectUrlFor } from '../lib/images';
import { buildMoodboard } from '../lib/autofill';
import Modal from '../components/Modal';
import PinterestImport from '../components/PinterestImport';

export default function Collection() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [images, setImages] = useState<ImageRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBoard, setHasBoard] = useState(false);
  const [showPinterest, setShowPinterest] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  const [building, setBuilding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(() => {
    if (params.get('exportSuccess') === 'download') return 'PDF exported successfully.';
    if (params.get('exportSuccess') === 'email') return 'Your PDF has been emailed.';
    return null;
  });

  useEffect(() => {
    if (params.has('exportSuccess')) {
      const newParams = new URLSearchParams(params);
      newParams.delete('exportSuccess');
      setParams(newParams, { replace: true });
    }
  }, [params, setParams]);

  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const p = await getProject(id);
    setProject(p ?? null);
    if (p) {
      setImages(await listProjectImages(p.id));
      setLoading(false);
      setHasBoard((await listPages(p.id)).length > 0);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function addBlobs(blobs: Blob[], source: ImageRec['source']) {
    for (const blob of blobs) {
      if (blob.size > 10 * 1024 * 1024) {
        setToast('An image exceeds the 10MB limit and was skipped.');
        return 0;
      }
    }
    let added = 0;
    for (const blob of blobs) {
      try {
        const normalized = await normalizeImage(blob);
        await putImage({ projectId: id, styleGroupId: null, blob: normalized, source });
        added += 1;
      } catch {
        // Non-image or unreadable file — skip.
      }
    }
    if (added > 0) refresh();
    return added;
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) addBlobs(files, 'upload');
  }

  // Clipboard paste support
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = [...(e.clipboardData?.items ?? [])];
      const blobs = items
        .filter((i) => i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (blobs.length) {
        e.preventDefault();
        addBlobs(blobs, 'paste').then((n) => n > 0 && setToast(`Pasted ${n} image${n === 1 ? '' : 's'}`));
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function removeImage(imageId: string) {
    await deleteImage(imageId);
    refresh();
  }

  async function createMoodboard() {
    if (images.length === 0 || building) return;
    setBuilding(true);
    const p = (await getProject(id))!;
    await deleteProjectPages(id);
    const pages = buildMoodboard(p, images);
    for (const page of pages) await putPage(page);
    navigate(`/projects/${id}/editor`);
  }

  if (project === undefined) return null;
  if (project === null) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-16">
        <p className="font-semibold text-lg text-ink">Project not found.</p>
        <Link to="/projects" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
          ← Go back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div
      className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Top-Left Breadcrumbs */}
      <div className="flex items-center gap-3 text-sm text-text-muted mb-3">
        <Link to="/projects" className="inline-flex items-center gap-1 hover:text-ink transition-colors">
          <div className="flex items-center justify-center w-5 h-5 shrink-0">
            <ArrowLeft size={16} strokeWidth={1.5} />
          </div>
          Projects
        </Link>
      </div>

      {/* Top-Left Header Bar with Primary Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">{project.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-muted text-text-muted uppercase tracking-wider">
              {project.orientation}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {images.length} reference{images.length === 1 ? '' : 's'}
            {hasBoard ? ' · moodboard created' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setShowPinterest(true)}>
            Import Pinterest
          </button>
          <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
            Upload
          </button>
          {hasBoard ? (
            <Link to={`/projects/${id}/editor`} className="btn-primary">
              Open moodboard
            </Link>
          ) : (
            <button
              className="btn-primary"
              disabled={images.length === 0 || building}
              onClick={() => setShowConfirm(true)}
            >
              {building ? 'Building…' : 'Create Moodboard'}
            </button>
          )}
        </div>
      </div>

      {showConfirm && project && (
        <Modal title="Create Moodboard" onClose={() => setShowConfirm(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              Generate a moodboard for <strong className="text-ink">{project.name}</strong> using {images.length} image{images.length === 1 ? '' : 's'} in {project.orientation} orientation?
            </p>
            <div className="flex items-center gap-2 justify-end mt-2">
              <button className="btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-primary" disabled={building} onClick={() => { setShowConfirm(false); createMoodboard(); }}>
                {building ? 'Building...' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) addBlobs(files, 'upload');
          e.target.value = '';
        }}
      />

      {loading ? (
        <div className="animate-pulse h-64 bg-surface rounded-lg" />
      ) : images.length === 0 ? (
        /* Empty State with 3-Action Quick Start Cards (Inspired by Reference Image 3 & 4) */
        <div className="space-y-8">
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-text-muted mb-4">
              <Camera size={22} strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-ink">No references collected yet</h2>
            <p className="mt-1 text-sm text-text-muted max-w-md mb-8">
              Collect images to compose your moodboard. You can import from Pinterest, upload files, or browse curated styles.
            </p>

            {/* 3 Quick Action Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl text-left">
              <button
                onClick={() => setShowPinterest(true)}
                className="card p-5 hover:shadow-lift transition-all group border-[1.5px] border-surface-muted flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-text-muted mb-3 group-hover:bg-accent-soft group-hover:text-accent transition-colors">
                    <Sparkles size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                    Import Pinterest Board
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    Paste any public Pinterest board URL to extract high-res pins.
                  </p>
                </div>
                <span className="mt-4 text-xs font-bold text-accent">Import →</span>
              </button>

              <button
                onClick={() => fileInput.current?.click()}
                className="card p-5 hover:shadow-lift transition-all group border-[1.5px] border-surface-muted flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-text-muted mb-3 group-hover:bg-accent-soft group-hover:text-accent transition-colors">
                    <Upload size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                    Upload from Computer
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    Select JPG, PNG, or WebP files or drag & drop anywhere on page.
                  </p>
                </div>
                <span className="mt-4 text-xs font-bold text-accent">Choose files →</span>
              </button>

              <Link
                to="/explore/graphic-design"
                className="card p-5 hover:shadow-lift transition-all group border-[1.5px] border-surface-muted flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-text-muted mb-3 group-hover:bg-accent-soft group-hover:text-accent transition-colors">
                    <Compass size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                    Explore Curated Styles
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    Browse studio reference collections and save them straight to this board.
                  </p>
                </div>
                <span className="mt-4 text-xs font-bold text-accent">Browse →</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Image Masonry Grid */
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-5 [&>*]:mb-5">
          {images.map((img) => (
            <div key={img.id} className="relative group break-inside-avoid rounded-lg overflow-hidden bg-surface shadow-sm">
              <img
                src={objectUrlFor(img.id, img.blob)}
                alt=""
                className="w-full block"
                loading="lazy"
              />
              <button
                onClick={() => removeImage(img.id)}
                aria-label="Remove image"
                className="absolute top-2 right-2 p-1.5 rounded-md bg-ink/60 text-bg opacity-0 group-hover:opacity-100 hover:bg-danger transition"
              >
                <div className="flex items-center justify-center w-5 h-5 shrink-0">
                  <Trash2 size={16} strokeWidth={1.5} />
                </div>
              </button>
              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-ink/60 text-bg opacity-0 group-hover:opacity-100 transition capitalize">
                {img.source}
              </span>
            </div>
          ))}
        </div>
      )}

      {dragOver && (
        <div className="fixed inset-0 z-40 pointer-events-none bg-accent/10 flex items-center justify-center">
          <p className="rounded-lg bg-ink text-bg px-6 py-3 font-semibold shadow-pop">
            Drop images to add them
          </p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-ink text-bg px-4 py-2 text-sm font-semibold shadow-pop z-50">
          {toast}
        </div>
      )}

      {showPinterest && (
        <PinterestImport
          projectId={id}
          existingImages={images}
          onClose={() => setShowPinterest(false)}
          onImported={refresh}
        />
      )}
    </div>
  );
}
