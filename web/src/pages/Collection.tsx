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
import PinterestPopover from '../components/PinterestPopover';
import { Keycap, PinterestIcon } from '../components/Keycap';

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
          {images.length > 0 && (
            <div className="relative group hidden md:inline-flex items-center">
              <div className="flex items-center gap-1 bg-black/[0.04] hover:bg-black/[0.08] px-2 py-1.5 rounded-lg transition-colors cursor-default select-none">
                <Keycap label="⌘" className="h-4 min-w-[18px] text-[9px]" />
                <Keycap label="V" className="h-4 min-w-[18px] text-[9px]" />
              </div>
              {/* Customized Tooltip on Hover */}
              <div className="absolute top-full right-0 mt-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 z-50 whitespace-nowrap bg-ink text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg">
                Press ⌘V anywhere to paste images
              </div>
            </div>
          )}
          <PinterestPopover projectId={id} existingImages={images} onImported={refresh} />
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
        /* Tactile Apple/Craft 3-Card Empty State */
        <div className="py-12 flex flex-col items-center justify-center max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-bold text-ink tracking-tight">No references yet</h2>
            <p className="text-sm text-text-muted">
              Add visual references to compose your moodboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
            {/* Card 1: Paste or upload files with 3D Keycaps (Solid Whitish-Orange) */}
            <div
              onClick={() => fileInput.current?.click()}
              className="group relative aspect-[1.15/1] rounded-3xl p-6 bg-[#FAF4EC] hover:bg-[#F5ECE0] shadow-xs hover:shadow-xl transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between"
            >
              {/* Top: 3D Keycaps */}
              <div className="relative z-10 flex items-center gap-1.5">
                <Keycap label="⌘" className="h-8 min-w-[32px] text-sm" />
                <Keycap label="V" className="h-8 min-w-[32px] text-sm" />
              </div>

              {/* Grounded & High-Contrast Bottom Content */}
              <div className="relative z-10 space-y-1 pt-4">
                <h3 className="text-base sm:text-lg font-extrabold text-ink tracking-tight leading-snug">
                  Paste or upload files
                </h3>
                <p className="text-xs font-semibold text-ink/75 leading-relaxed">
                  Drop images here or press ⌘V anywhere
                </p>
                <span className="text-[11px] font-bold text-ink/80 pt-1 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Select from device</span>
                  <span>→</span>
                </span>
              </div>
            </div>

            {/* Card 2: Pinterest Popover with Authentic Logo (Solid Clean Grey) */}
            <div className="group relative z-20 aspect-[1.15/1] rounded-3xl p-6 bg-[#F2F2F0] hover:bg-[#EAEAE8] shadow-xs hover:shadow-xl transition-all duration-300 ease-out flex flex-col justify-between">
              {/* Top: Pinterest Icon */}
              <div className="relative z-10 w-9 h-9 rounded-xl bg-white shadow-2xs flex items-center justify-center text-[#E60023]">
                <PinterestIcon size={20} />
              </div>

              {/* Grounded & High-Contrast Bottom Content */}
              <div className="relative z-10 space-y-2 pt-4">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-ink tracking-tight leading-snug">
                    Pinterest
                  </h3>
                  <p className="text-xs font-semibold text-ink/75 mt-0.5 leading-relaxed">
                    Import pins directly from your boards
                  </p>
                </div>
                <PinterestPopover
                  projectId={id}
                  existingImages={images}
                  onImported={refresh}
                  align="center"
                  className="w-full block"
                  triggerClassName="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-white/90 hover:bg-white text-xs font-bold text-ink shadow-xs transition-all"
                />
              </div>
            </div>

            {/* Card 3: Curated Styles with Sparkle (Solid Whitish-Orange) */}
            <Link
              to="/explore/graphic-design"
              className="group relative aspect-[1.15/1] rounded-3xl p-6 bg-[#FAF4EC] hover:bg-[#F5ECE0] shadow-xs hover:shadow-xl transition-all duration-300 ease-out flex flex-col justify-between"
            >
              {/* Top: Sparkle Icon */}
              <div className="relative z-10 w-9 h-9 rounded-xl bg-white shadow-2xs flex items-center justify-center text-amber-600">
                <Sparkles size={18} strokeWidth={1.8} />
              </div>

              {/* Grounded & High-Contrast Bottom Content */}
              <div className="relative z-10 space-y-1 pt-4">
                <h3 className="text-base sm:text-lg font-extrabold text-ink tracking-tight leading-snug">
                  Curated Styles
                </h3>
                <p className="text-xs font-semibold text-ink/75 leading-relaxed">
                  Browse studio reference collections
                </p>
                <span className="text-[11px] font-bold text-ink/80 pt-1 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Explore catalogue</span>
                  <span>→</span>
                </span>
              </div>
            </Link>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-ink/90 text-white text-xs font-medium backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
}
