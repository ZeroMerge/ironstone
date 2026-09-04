import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Page, ImageRec } from '../lib/types';
import { listPages, listProjectImages, deleteProject, duplicateProject, putImage } from '../db/repo';
import { normalizeImage } from '../lib/images';
import { 
  ArrowUpRight, 
  Copy, 
  Trash2, 
  CheckCircle2,
  FolderSync
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  index?: number;
  onDeleted?: () => void;
  onDuplicated?: () => void;
  onUpdated?: () => void;
}

// 32 Curated Light Clay & Ceramic Swatches:
// Light, airy, matte pottery, bisque, travertine, celadon, and mineral slip tones (~88-92% lightness)
// Guarantees maximum contrast with high-contrast ink typography (#111110)
export const LIGHT_CLAY_PALETTES = [
  // 1. Warm Terracotta, Peach & Adobe Creams
  { name: 'Pale Terracotta', bg: '#F7D6C8' },
  { name: 'Peach Bisque', bg: '#F9DDD2' },
  { name: 'Sunbaked Sand', bg: '#F6E0D3' },
  { name: 'Tuscan Apricot Cream', bg: '#F9E2CF' },
  { name: 'Warm Adobe Mist', bg: '#F5D7D3' },

  // 2. Raw Ochre, Saffron & Sandstone Clay
  { name: 'French Ochre Cream', bg: '#F5E4C4' },
  { name: 'Warm Sandstone', bg: '#F3E5D4' },
  { name: 'Golden Wheat Slip', bg: '#F7E8CB' },
  { name: 'Honed Travertine', bg: '#F4E9DC' },
  { name: 'Desert Dune', bg: '#F7EBD8' },
  { name: 'Raw Honey Stoneware', bg: '#F9E8D0' },
  { name: 'Pale Amber Slip', bg: '#FAE6CE' },

  // 3. Celadon, Sage & Herbaceous Minerals
  { name: 'Celadon Mist', bg: '#D9E7DD' },
  { name: 'Nordic Sage Pebble', bg: '#DCE8DF' },
  { name: 'Eucalyptus Slip', bg: '#D4E3D8' },
  { name: 'Pale Matcha Clay', bg: '#DFE9D8' },
  { name: 'Washed Olive Plaster', bg: '#E2EAD9' },
  { name: 'Sea-Glass Mint', bg: '#D6E7E2' },
  { name: 'Pale Lichen', bg: '#DCE6DA' },

  // 4. Slate, Bluestone & Coastal Minerals
  { name: 'Coastal Bluestone', bg: '#D7E3EC' },
  { name: 'Pale Slate Ceramic', bg: '#DAE5ED' },
  { name: 'Fjord Blue Stone', bg: '#D3E4EB' },
  { name: 'Alpine Mineral Mist', bg: '#DDE8EF' },
  { name: 'Studio Cloud Slip', bg: '#E3E7EB' },
  { name: 'Nordic Sky Clay', bg: '#D8E5EE' },

  // 5. Mineral Lilac, Chalk Plum & Heather
  { name: 'Chalk Lilac', bg: '#E7DCEE' },
  { name: 'Muted Wisteria', bg: '#E3D9EC' },
  { name: 'Heather Clay', bg: '#EADEEC' },
  { name: 'Lavender Basalt', bg: '#E5E0ED' },
  { name: 'Plaster Orchid', bg: '#E8DEEC' },

  // 6. Warm Stone, Kaolin & Alabaster
  { name: 'Kaolin White Clay', bg: '#F4EFEA' },
  { name: 'Limestone Chalk', bg: '#EEEAE4' },
];

function getProjectPalette(id: string, index?: number) {
  // 32-bit FNV-1a high-entropy hash algorithm
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // If index is provided, advance by coprime step (7) so adjacent grid cards never repeat colors
  const offset = index !== undefined ? index * 7 : 0;
  const idx = Math.abs((hash ^ (hash >>> 16)) + offset) % LIGHT_CLAY_PALETTES.length;
  return LIGHT_CLAY_PALETTES[idx];
}

function formatRelativeTime(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ProjectCard({
  project,
  index,
  onDeleted,
  onDuplicated,
  onUpdated,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const palette = getProjectPalette(project.id, index);

  const [images, setImages] = useState<ImageRec[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listProjectImages(project.id),
      listPages(project.id),
    ]).then(([imgs, pgs]) => {
      if (!cancelled) {
        setImages(imgs);
        setPages(pgs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const hasMoodboard = pages.length > 0;
  const formatLabel = 
    project.orientation === 'portrait'
      ? 'A4 Portrait'
      : project.orientation === 'landscape'
        ? 'A4 Landscape'
        : '16:9';

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setBusy(true);
    try {
      for (const file of files) {
        const blob = await normalizeImage(file);
        await putImage({
          projectId: project.id,
          styleGroupId: null,
          blob,
          source: 'upload',
        });
      }
      const updatedImages = await listProjectImages(project.id);
      setImages(updatedImages);
      onUpdated?.();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await duplicateProject(project.id);
      onDuplicated?.();
    } catch {
      // ignore
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(project.id);
      onDeleted?.();
    } catch {
      // ignore
    }
  }

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
      style={{ backgroundColor: palette.bg }}
      className={`group relative w-full aspect-[1.12/1] rounded-3xl p-6 sm:p-6.5 cursor-pointer select-none overflow-hidden transition-all duration-300 ease-out shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.12)] hover:scale-[1.018] active:scale-[0.99] text-ink flex flex-col justify-between ${
        isDragOver ? 'ring-2 ring-accent scale-[1.02]' : ''
      }`}
    >
      {/* Top Bar: Crisp White Format Pill, Workflow Status, and Action Buttons */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold text-ink bg-white/85 shadow-2xs backdrop-blur-sm">
            {formatLabel}
          </span>

          {hasMoodboard && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-900 bg-white/85 shadow-2xs backdrop-blur-sm">
              <CheckCircle2 size={11} className="text-emerald-700" />
              <span>Built</span>
            </span>
          )}
        </div>

        {/* Top-Right Tactile Action Buttons (Appear on Hover) */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {hasMoodboard && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projects/${project.id}/editor`);
                }}
                className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white text-ink flex items-center justify-center backdrop-blur-md shadow-xs transition-transform hover:scale-105"
                title="Open Moodboard Editor"
              >
                <ArrowUpRight size={15} strokeWidth={2} />
              </button>
            )}

            <button
              onClick={handleDuplicate}
              className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white text-ink flex items-center justify-center backdrop-blur-md shadow-xs transition-transform hover:scale-105"
              title="Duplicate Project"
            >
              <Copy size={13} strokeWidth={2} />
            </button>

            <button
              onClick={handleDelete}
              className="w-8 h-8 rounded-xl bg-white/90 hover:bg-red-50 text-ink hover:text-red-600 flex items-center justify-center backdrop-blur-md shadow-xs transition-transform hover:scale-105"
              title="Delete Project"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Grounded Bottom Content (Crisp High-Contrast Typography) */}
      <div className="relative z-10 space-y-2 pt-4">
        <div>
          <h3
            className="text-xl font-extrabold tracking-tight text-ink truncate leading-snug"
            title={project.name}
          >
            {project.name}
          </h3>
          <p className="text-xs font-bold text-ink/75 mt-0.5 flex items-center gap-1.5">
            <span>{images.length} {images.length === 1 ? 'reference' : 'references'}</span>
            {pages.length > 0 && (
              <>
                <span className="opacity-40">•</span>
                <span>{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-ink/75 pt-2.5 mt-2.5 border-t border-black/[0.07]">
          <span className="font-mono text-[11px] font-bold">
            {formatRelativeTime(project.createdAt)}
          </span>

          <span className="font-bold text-[11px] text-ink group-hover:underline inline-flex items-center gap-1">
            <span>{hasMoodboard ? 'Open board' : 'Add references'}</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>

      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 rounded-3xl bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-100">
          <FolderSync size={32} className="text-accent animate-bounce mb-2" />
          <p className="font-bold text-sm text-ink">Drop to add directly</p>
          <p className="text-xs opacity-75 mt-0.5 text-text-muted">Assets will be saved into {project.name}</p>
        </div>
      )}
    </div>
  );
}
