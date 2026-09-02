import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Maximize2, Columns, Type, Image as ImageIcon, Check, MousePointer2, Trash2, Copy, MonitorPlay, Grid2X2, AlignLeft, AlignCenter, AlignRight, Bold, Italic, CornerDownRight, Layers, GripHorizontal, Palette, ArrowLeft, LayoutGrid, SlidersHorizontal, ArrowUp, ArrowDown, Upload } from 'lucide-react';
import { SidebarSimple, FrameCorners, SquaresFour } from '@phosphor-icons/react';
import {
  getProject,
  listPages,
  listProjectImages,
  putPage,
  deletePage,
  getImage,
  putImage,
  updateProject,
} from '../db/repo';
import { extractPalette } from '../lib/palette';
import PalettePopover from '../editor/PalettePopover';
import type { Block, ImageRec, Page, Project, ProjectStyles } from '../lib/types';
import {
  clampBlock,
  COLS,

  rowsFor,
  templateBlocks,
  continuationBlocks,
  uid,
  blocksOverlap,
  getMinFootprint,
} from '../lib/grid';
import GridSurface, { blockStyle } from '../editor/GridSurface';
import BlockStatic from '../editor/BlockStatic';
import InlineTextEditor from '../editor/InlineTextEditor';
import { objectUrlFor, normalizeImage } from '../lib/images';
import Modal from '../components/Modal';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type DragState =
  | { mode: 'move'; blockId: string; startX: number; startY: number; origX: number; origY: number }
  | {
    mode: 'resize';
    direction: ResizeDirection;
    blockId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  };

function findFreeSpot(blocks: Block[], rows: number, w: number, h: number): { x: number; y: number } {
  for (let y = 0; y <= rows - h; y++) {
    for (let x = 0; x <= COLS - w; x++) {
      const probe: Block = { id: '', type: 'colorSwatch', x, y, w, h, content: '' };
      if (!blocks.some((b) => blocksOverlap(b, probe))) return { x, y };
    }
  }
  return { x: 0, y: Math.max(0, rows - h) };
}

export default function Editor() {
  const { id = '' } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<ImageRec[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'focus' | 'overview' | 'zen'>('focus');
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'design' | 'components' | 'assets'>('design');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [zenMessage, setZenMessage] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(224);
  const [rightWidth, setRightWidth] = useState(288);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      if (!isResizing) return;
      e.preventDefault();

      const maxW = window.innerWidth * 0.3;

      if (isResizing === 'left') {
        const newW = e.clientX;
        if (newW < 120) {
          setLeftOpen(false);
          setLeftWidth(224);
          setIsResizing(null);
        } else {
          setLeftOpen(true);
          setLeftWidth(Math.min(newW, maxW));
        }
      } else if (isResizing === 'right') {
        const newW = window.innerWidth - e.clientX;
        if (newW < 150) {
          setRightInspectorOpen(false);
          setRightWidth(288);
          setIsResizing(null);
        } else {
          setRightInspectorOpen(true);
          setRightWidth(Math.min(newW, maxW));
        }
      }
    }

    function handlePointerUp() {
      setIsResizing(null);
      document.body.style.cursor = 'default';
    }

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = 'default';
    };
  }, [isResizing]);


  const [pickerBlockId, setPickerBlockId] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[]>([]);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [paletteEditState, setPaletteEditState] = useState<{ block: Block; index: number; rect: DOMRect } | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [, forceRender] = useState(0);

  useEffect(() => {
    if (project?.palette) setPalette(project.palette);
  }, [project]);

  const rows = rowsFor(project?.orientation ?? 'landscape');

  useEffect(() => {
    (async () => {
      const p = await getProject(id);
      if (!p) {
        setLoading(false);
        return;
      }
      setProject(p);
      const pg = await listPages(id);
      setPages(pg);
      setActivePageId(pg[0]?.id ?? null);
      setImages(await listProjectImages(id));
      setLoading(false);
    })();
  }, [id]);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? null,
    [pages, activePageId]
  );

  const persistPage = useCallback((page: Page) => {
    setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)));
    void putPage(page);
  }, []);

  function updateBlock(pageId: string, block: Block) {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    persistPage({ ...page, blocks: page.blocks.map((b) => (b.id === block.id ? block : b)) });
  }

  const showZenMessage = (msg: string) => {
    setZenMessage(msg);
    setTimeout(() => setZenMessage(null), 2000);
  };

  const navigateZen = useCallback((direction: 'next' | 'prev') => {
    const idx = pages.findIndex(p => p.id === activePageId);
    if (direction === 'next') {
      if (idx < pages.length - 1) setActivePageId(pages[idx + 1].id);
      else showZenMessage("End of presentation");
    } else {
      if (idx > 0) setActivePageId(pages[idx - 1].id);
      else showZenMessage("Start of presentation");
    }
  }, [pages, activePageId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (viewMode === 'zen') {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
          setViewMode('focus');
        } else {
          setRightInspectorOpen(false);
        }
      }
      if (viewMode === 'zen') {
        if (e.key === 'ArrowRight' || e.key === ' ') navigateZen('next');
        if (e.key === 'ArrowLeft') navigateZen('prev');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, navigateZen]);

  // Keyboard shortcut: Delete selected block
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingId) return;
        if (!selectedId || !activePageId) return;
        setPages((prev) => {
          const pg = prev.find((p) => p.id === activePageId);
          if (!pg) return prev;
          const updated = { ...pg, blocks: pg.blocks.filter((b) => b.id !== selectedId) };
          persistPage(updated);
          setSelectedId(null);
          return prev.map((p) => (p.id === activePageId ? updated : p));
        });
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, activePageId, editingId, persistPage]);

  // Paste image handler (Ctrl+V)
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      if (!activePageId) return;
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
      const items = [...(e.clipboardData?.items ?? [])];
      const blobs = items
        .filter((i) => i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);

      if (blobs.length > 0) {
        e.preventDefault();
        setPages((prev) => {
          const pIdx = prev.findIndex((p) => p.id === activePageId);
          if (pIdx === -1) return prev;
          const current = prev[pIdx];

          (async () => {
            const addedBlocks: Block[] = [];
            const newImages: ImageRec[] = [];
            for (const blob of blobs) {
              try {
                const normalized = await normalizeImage(blob);
                const img = await putImage({ projectId: id, styleGroupId: null, blob: normalized, source: 'paste' });
                newImages.push(img);
                const spot = findFreeSpot([...current.blocks, ...addedBlocks], rows, 16, 16);
                addedBlocks.push({ id: uid(), type: 'image', x: spot.x, y: spot.y, w: 16, h: 16, content: img.id });
              } catch {
                // Ignore unreadable image
              }
            }
            if (addedBlocks.length > 0) {
              setImages((prevImgs) => [...prevImgs, ...newImages]);
              const nextPg = { ...current, blocks: [...current.blocks, ...addedBlocks] };
              setPages((oldPages) => oldPages.map((p) => (p.id === nextPg.id ? nextPg : p)));
              void putPage(nextPg);
            }
          })();
          return prev;
        });
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [id, activePageId, rows]);

  // ---------- 48×32 Drag & 8-Point Resize Mechanics ----------

  function cellSize() {
    const el = surfaceRef.current?.querySelector<HTMLElement>('[data-grid-inner]');
    if (!el) return { w: 1, h: 1 };
    const rect = el.getBoundingClientRect();
    return { w: rect.width / COLS, h: rect.height / rows };
  }

  function onBlockPointerDown(e: React.PointerEvent, block: Block) {
    if (editingId === block.id) return;
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;

    const isTextBlock = block.type === 'title' || block.type === 'subtitle' || block.type === 'text' || block.type === 'caption';
    // If text block is already selected, let click through directly to enter editing mode
    if (isTextBlock && selectedId === block.id) {
      setEditingId(block.id);
      return;
    }

    e.preventDefault();
    setSelectedId(block.id);
    dragRef.current = {
      mode: 'move',
      blockId: block.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: block.x,
      origY: block.y,
    };
    setIsInteracting(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizePointerDown(e: React.PointerEvent, block: Block, direction: ResizeDirection) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: 'resize',
      direction,
      blockId: block.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: block.x,
      origY: block.y,
      origW: block.w,
      origH: block.h,
    };
    setIsInteracting(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !activePage) return;
    const cell = cellSize();
    const block = activePage.blocks.find((b) => b.id === drag.blockId);
    if (!block) return;

    if (drag.mode === 'move') {
      const dx = Math.round((e.clientX - drag.startX) / cell.w);
      const dy = Math.round((e.clientY - drag.startY) / cell.h);
      const next = clampBlock({ ...block, x: drag.origX + dx, y: drag.origY + dy }, rows);
      if (next.x !== block.x || next.y !== block.y) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === activePage.id
              ? { ...p, blocks: p.blocks.map((b) => (b.id === block.id ? next : b)) }
              : p
          )
        );
      }
    } else {
      const { minW, minH } = getMinFootprint(block.type);
      const dx = Math.round((e.clientX - drag.startX) / cell.w);
      const dy = Math.round((e.clientY - drag.startY) / cell.h);
      const dir = drag.direction;

      let newX = drag.origX;
      let newY = drag.origY;
      let newW = drag.origW;
      let newH = drag.origH;

      // Horizontal resizing logic
      if (dir.includes('e')) {
        newW = Math.max(minW, Math.min(COLS - drag.origX, drag.origW + dx));
      } else if (dir.includes('w')) {
        const maxLeftShift = drag.origX + drag.origW - minW;
        const clampedX = Math.max(0, Math.min(maxLeftShift, drag.origX + dx));
        newW = drag.origW + (drag.origX - clampedX);
        newX = clampedX;
      }

      // Vertical resizing logic
      if (dir.includes('s')) {
        newH = Math.max(minH, Math.min(rows - drag.origY, drag.origH + dy));
      } else if (dir.includes('n')) {
        const maxTopShift = drag.origY + drag.origH - minH;
        const clampedY = Math.max(0, Math.min(maxTopShift, drag.origY + dy));
        newH = drag.origH + (drag.origY - clampedY);
        newY = clampedY;
      }

      const next = clampBlock({ ...block, x: newX, y: newY, w: newW, h: newH }, rows);
      if (next.x !== block.x || next.y !== block.y || next.w !== block.w || next.h !== block.h) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === activePage.id
              ? { ...p, blocks: p.blocks.map((b) => (b.id === block.id ? next : b)) }
              : p
          )
        );
      }
    }
    forceRender((n) => n + 1);
  }

  function onPointerUp() {
    setIsInteracting(false);
    const drag = dragRef.current;
    if (drag && activePage) {
      const current = pages.find((p) => p.id === activePage.id);
      if (current) void putPage(current);
    }
    dragRef.current = null;
  }

  // ---------- Block Operations ----------

  function removeSelected() {
    if (!activePage || !selectedId) return;
    persistPage({ ...activePage, blocks: activePage.blocks.filter((b) => b.id !== selectedId) });
    setSelectedId(null);
  }

  function commitText(block: Block, text: string) {
    if (!activePage) return;
    updateBlock(activePage.id, { ...block, content: text });
  }

  function assignImage(blockId: string, imageId: string) {
    if (!activePage) return;
    const block = activePage.blocks.find((b) => b.id === blockId);
    if (!block) return;
    updateBlock(activePage.id, { ...block, content: imageId });
    setPickerBlockId(null);
  }

  async function addPage() {
    if (!project) return;
    const newBlocks = continuationBlocks(project.orientation);
    const newPage: Page = {
      id: uid(),
      projectId: project.id,
      order: pages.length,
      blocks: newBlocks,
    };
    await putPage(newPage);
    setPages((prev) => [...prev, newPage]);
    setActivePageId(newPage.id);
  }

  async function duplicatePage(pageId: string) {
    const pageToDup = pages.find((p) => p.id === pageId);
    if (!pageToDup) return;

    // We need to generate new IDs for the page and all its blocks
    const newPage: Page = {
      ...pageToDup,
      id: Date.now().toString(),
      order: pages.length,
      blocks: pageToDup.blocks.map(b => ({ ...b, id: uid() }))
    };

    await putPage(newPage);
    setPages((prev) => [...prev, newPage]);
    setActivePageId(newPage.id);
  }

  async function removePage(pageId: string) {
    if (pages.length <= 1) return;
    await deletePage(pageId);
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== pageId);
      if (activePageId === pageId) setActivePageId(next[0]?.id ?? null);
      return next;
    });
  }

  async function generatePalette(source: 'page' | 'project') {
    setPaletteBusy(true);
    try {
      let targetBlobs: Blob[] = [];
      if (source === 'page' && activePage) {
        const imageIds = activePage.blocks
          .filter((b) => b.type === 'image' && b.content)
          .map((b) => b.content);
        const pageImgs = images.filter((img) => imageIds.includes(img.id));
        targetBlobs = pageImgs.map((img) => img.blob);
      } else {
        targetBlobs = images.map((img) => img.blob);
      }

      if (targetBlobs.length === 0) return;
      const newPalette = await extractPalette(targetBlobs, 5);
      setPalette(newPalette);
      if (project) {
        await updateProject({ ...project, palette: newPalette });
      }
    } finally {
      setPaletteBusy(false);
    }
  }

  function addSwatch(hex: string) {
    if (!activePage) return;
    const spot = findFreeSpot(activePage.blocks, rows, 8, 4);
    const newBlock: Block = {
      id: uid(),
      type: 'colorSwatch',
      x: spot.x,
      y: spot.y,
      w: 8,
      h: 4,
      content: hex,
    };
    persistPage({ ...activePage, blocks: [...activePage.blocks, newBlock] });
  }

  if (!project) return null;


  const pagesListJsx = (
    <div className="flex flex-col h-full pt-3">
      <div className="flex items-center justify-between mb-3 px-2 mt-1">
        <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase">
          Pages ({pages.length})
        </div>
        <button onClick={addPage} className="p-1 text-text-muted hover:text-ink hover:bg-surface-active rounded transition" title="Add Page">
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-hover px-2 pt-1 pb-3">
        {pages.map((p, i) => (
          <div
            key={p.id}
            onClick={() => {
              setActivePageId(p.id);
              setSelectedId(null);
              if (viewMode === 'overview') setViewMode('focus');
            }}
            className={`group relative cursor-pointer rounded-lg p-2 transition-all flex-shrink-0 ${activePageId === p.id && viewMode === 'focus' ? "bg-black/5 shadow-sm ring-1 ring-black/30" : "hover:bg-black/5"}`}
          >
            <div className="pointer-events-none rounded overflow-hidden shadow-sm border-[1.5px] border-surface-muted bg-white relative">
              <GridSurface
                orientation={project.orientation}
                styles={project.styles}
                className="w-full pointer-events-none"
              >
                {p.blocks.map((b) => (
                  <div key={b.id} style={blockStyle(b, rows)}>
                    <EditorBlockContent block={b} />
                  </div>
                ))}
              </GridSurface>
              <div className={`absolute inset-0 transition-colors ${activePageId === p.id && viewMode === 'focus' ? 'bg-black/[0.02]' : 'bg-black/0 group-hover:bg-black/[0.04]'}`} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-text-muted">
              <span className="font-semibold">Page {i + 1}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicatePage(p.id);
                  }}
                  className="p-1 text-text-faint hover:text-ink rounded"
                  title="Duplicate page"
                >
                  <Copy size={12} strokeWidth={1.5} />
                </button>
                {pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(p.id);
                    }}
                    className="p-1 text-text-faint hover:text-danger rounded"
                    title="Delete page"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>


    </div>
  );

  // Derived: the currently selected block object
  const selectedBlock = selectedId ? activePage?.blocks.find(b => b.id === selectedId) ?? null : null;

  // Helpers: update a block's style or data fields
  function patchBlock(patch: Partial<Block['style']>) {
    if (!selectedBlock || !activePage) return;
    updateBlock(activePage.id, { ...selectedBlock, style: { ...selectedBlock.style, ...patch } });
  }
  function patchBlockData(patch: Record<string, any>) {
    if (!selectedBlock || !activePage) return;
    updateBlock(activePage.id, { ...selectedBlock, data: { ...selectedBlock.data, ...patch } });
  }
  function patchBlockType(newType: Block['type']) {
    if (!selectedBlock || !activePage) return;
    updateBlock(activePage.id, { ...selectedBlock, type: newType });
  }
  function duplicateSelected() {
    if (!selectedBlock || !activePage) return;
    const spot = findFreeSpot(activePage.blocks, rowsFor(project?.orientation ?? 'landscape'), selectedBlock.w, selectedBlock.h);
    const dup: Block = { ...selectedBlock, id: uid(), x: spot.x, y: spot.y };
    persistPage({ ...activePage, blocks: [...activePage.blocks, dup] });
    setSelectedId(dup.id);
  }
  function bringForward() {
    if (!selectedBlock || !activePage) return;
    const curZ = selectedBlock.zIndex ?? 0;
    updateBlock(activePage.id, { ...selectedBlock, zIndex: curZ + 1 });
  }
  function sendBackward() {
    if (!selectedBlock || !activePage) return;
    const curZ = selectedBlock.zIndex ?? 0;
    updateBlock(activePage.id, { ...selectedBlock, zIndex: Math.max(0, curZ - 1) });
  }
  // Update project styles (global document styles)
  async function patchStyles(patch: Partial<ProjectStyles>) {
    if (!project) return;
    const updated = { ...project, styles: { ...project.styles, ...patch } };
    setProject(updated);
    await updateProject(updated);
  }

  // ── Inspector sub-components ──────────────────────────────────────────────

  // Section label
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted/60 mb-2.5 px-1">{children}</div>
  );

  // Segmented Control wrapper
  const SegmentedControl = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center bg-surface-muted/50 p-1 rounded-lg gap-1">
      {children}
    </div>
  );

  // Segmented Pill
  const SegmentedPill = ({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button
      onClick={onClick}
      title={title}
      className={`flex-1 flex items-center justify-center py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 ${active ? 'bg-white text-ink shadow-sm ring-1 ring-black/5' : 'text-text-muted hover:text-ink hover:bg-black/5'}`}
    >
      {children}
    </button>
  );

  // Block action row
  const BlockActions = () => (
    <div className="flex items-center gap-1 mb-6 bg-surface-muted/30 p-1 rounded-lg">
      <button onClick={duplicateSelected} title="Duplicate" className="flex-1 flex justify-center py-1.5 rounded-md text-text-muted hover:text-ink hover:bg-black/5 transition-colors">
        <Copy size={14} strokeWidth={2} />
      </button>
      <button onClick={bringForward} title="Bring Forward" className="flex-1 flex justify-center py-1.5 rounded-md text-text-muted hover:text-ink hover:bg-black/5 transition-colors">
        <ArrowUp size={14} strokeWidth={2} />
      </button>
      <button onClick={sendBackward} title="Send Backward" className="flex-1 flex justify-center py-1.5 rounded-md text-text-muted hover:text-ink hover:bg-black/5 transition-colors">
        <ArrowDown size={14} strokeWidth={2} />
      </button>
      <button onClick={() => { if (activePage && selectedId) { persistPage({ ...activePage, blocks: activePage.blocks.filter(b => b.id !== selectedId) }); setSelectedId(null); } }} title="Delete" className="flex-1 flex justify-center py-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );

  // ── Design Tab Content ────────────────────────────────────────────────────

  const designTabContent = (() => {
    // TEXT BLOCK
    if (selectedBlock && (selectedBlock.type === 'title' || selectedBlock.type === 'subtitle' || selectedBlock.type === 'text' || selectedBlock.type === 'caption')) {
      const s = selectedBlock.style ?? {};
      const sz = s.fontSize ?? (selectedBlock.type === 'title' ? 32 : selectedBlock.type === 'subtitle' ? 20 : selectedBlock.type === 'caption' ? 11 : 14);
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-6">
            <SectionLabel>Hierarchy</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={selectedBlock.type === 'title'} onClick={() => patchBlockType('title')}>Title</SegmentedPill>
              <SegmentedPill active={selectedBlock.type === 'subtitle'} onClick={() => patchBlockType('subtitle')}>Subtitle</SegmentedPill>
              <SegmentedPill active={selectedBlock.type === 'text'} onClick={() => patchBlockType('text')}>Body</SegmentedPill>
              <SegmentedPill active={selectedBlock.type === 'caption'} onClick={() => patchBlockType('caption')}>Caption</SegmentedPill>
            </SegmentedControl>
          </div>
          <div className="mb-6">
            <SectionLabel>Size</SectionLabel>
            <div className="flex items-center bg-surface-muted/50 p-1 rounded-lg">
              <button onClick={() => patchBlock({ fontSize: Math.max(8, sz - 1) })} className="w-8 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-black/5 hover:text-ink transition-colors"><span className="w-3 h-0.5 bg-current rounded-full" /></button>
              <span className="flex-1 text-[12px] font-bold text-ink tabular-nums text-center">{sz}</span>
              <button onClick={() => patchBlock({ fontSize: Math.min(120, sz + 1) })} className="w-8 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-black/5 hover:text-ink transition-colors"><Plus size={14} strokeWidth={2.5} /></button>
            </div>
          </div>
          <div className="mb-6">
            <SectionLabel>Weight</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={s.fontWeight === '300'} onClick={() => patchBlock({ fontWeight: '300' })}>Light</SegmentedPill>
              <SegmentedPill active={!s.fontWeight || s.fontWeight === '400' || s.fontWeight === 'normal'} onClick={() => patchBlock({ fontWeight: '400' })}>Regular</SegmentedPill>
              <SegmentedPill active={s.fontWeight === '700' || s.fontWeight === 'bold'} onClick={() => patchBlock({ fontWeight: '700' })}>Bold</SegmentedPill>
            </SegmentedControl>
          </div>
          <div className="mb-6">
            <SectionLabel>Align</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={s.textAlign === 'left' || !s.textAlign} onClick={() => patchBlock({ textAlign: 'left' })} title="Left"><AlignLeft size={14} strokeWidth={2} /></SegmentedPill>
              <SegmentedPill active={s.textAlign === 'center'} onClick={() => patchBlock({ textAlign: 'center' })} title="Center"><AlignCenter size={14} strokeWidth={2} /></SegmentedPill>
              <SegmentedPill active={s.textAlign === 'right'} onClick={() => patchBlock({ textAlign: 'right' })} title="Right"><AlignRight size={14} strokeWidth={2} /></SegmentedPill>
            </SegmentedControl>
          </div>
          <div className="mb-6">
            <SectionLabel>Color</SectionLabel>
            <div className="flex items-center gap-3 bg-surface-muted/30 p-2 rounded-lg">
              <div className="w-6 h-6 rounded-md shadow-sm ring-1 ring-black/10 relative">
                <div className="absolute inset-0 rounded-md" style={{ background: s.color ?? '#111110' }} />
                <input
                  type="color"
                  value={s.color ?? '#111110'}
                  onChange={e => patchBlock({ color: e.target.value })}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  title="Text color"
                />
              </div>
              <span className="text-[12px] font-mono font-medium text-text-muted">{(s.color ?? '#111110').toUpperCase()}</span>
            </div>
          </div>
        </div>
      );
    }

    // IMAGE BLOCK
    if (selectedBlock && selectedBlock.type === 'image') {
      const s = selectedBlock.style ?? {};
      const fit = (s as any).objectFit ?? 'cover';
      const radius = s.borderRadius ?? (project?.styles?.cornerRadius ?? 8);
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-6">
            <SectionLabel>Fit</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={fit === 'cover'} onClick={() => patchBlock({ objectFit: 'cover' } as any)}>Fill</SegmentedPill>
              <SegmentedPill active={fit === 'contain'} onClick={() => patchBlock({ objectFit: 'contain' } as any)}>Fit</SegmentedPill>
              <SegmentedPill active={fit === 'none'} onClick={() => patchBlock({ objectFit: 'none' } as any)}>Crop</SegmentedPill>
            </SegmentedControl>
          </div>
          <div className="mb-6">
            <SectionLabel>Corner Radius — {radius}px</SectionLabel>
            <div className="bg-surface-muted/30 p-3 rounded-lg">
              <input
                type="range"
                min={0}
                max={48}
                value={radius}
                onChange={e => patchBlock({ borderRadius: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </div>
          </div>
          <button
            onClick={() => setPickerBlockId(selectedBlock.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-muted/30 rounded-lg text-[12px] font-semibold text-text-muted hover:text-ink hover:bg-surface-muted transition-colors"
          >
            <Upload size={14} strokeWidth={2} />
            Replace Image
          </button>
        </div>
      );
    }

    // PALETTE BLOCK
    if (selectedBlock && selectedBlock.type === 'palette') {
      const colors: string[] = selectedBlock.data?.colors ?? [];
      const format: string = selectedBlock.data?.format ?? 'hex';
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-6">
            <SectionLabel>Swatches</SectionLabel>
            <div className="flex items-center bg-surface-muted/50 p-1 rounded-lg">
              <button
                onClick={() => { if (colors.length > 3) patchBlockData({ colors: colors.slice(0, -1) }); }}
                className="w-8 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-black/5 hover:text-ink transition-colors"
              ><span className="w-3 h-0.5 bg-current rounded-full" /></button>
              <span className="flex-1 text-[12px] font-bold text-ink tabular-nums text-center">{colors.length}</span>
              <button
                onClick={() => { if (colors.length < 8) patchBlockData({ colors: [...colors, '#CCCCCC'] }); }}
                className="w-8 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-black/5 hover:text-ink transition-colors"
              ><Plus size={14} strokeWidth={2.5} /></button>
            </div>
          </div>
          <div className="mb-6">
            <SectionLabel>Format</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={format === 'hex'} onClick={() => patchBlockData({ format: 'hex' })}>HEX</SegmentedPill>
              <SegmentedPill active={format === 'rgb'} onClick={() => patchBlockData({ format: 'rgb' })}>RGB</SegmentedPill>
            </SegmentedControl>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={async () => {
                if (!activePage) return;
                const pageImageIds = new Set(activePage.blocks.filter(b => b.type === 'image' && b.content).map(b => b.content));
                const pageBlobs = images.filter(img => pageImageIds.has(img.id)).map(i => i.blob);
                if (pageBlobs.length > 0) {
                  const extracted = await extractPalette(pageBlobs, colors.length || 5);
                  patchBlockData({ colors: extracted });
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-muted/30 rounded-lg text-[12px] font-semibold text-text-muted hover:text-ink hover:bg-surface-muted transition-colors"
            >
              <Palette size={14} strokeWidth={2} />
              Extract from Page
            </button>
            <button
              onClick={async () => {
                const allBlobs = images.map(i => i.blob);
                if (allBlobs.length > 0) {
                  const extracted = await extractPalette(allBlobs, colors.length || 5);
                  patchBlockData({ colors: extracted });
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-muted/30 rounded-lg text-[12px] font-semibold text-text-muted hover:text-ink hover:bg-surface-muted transition-colors"
            >
              <Palette size={14} strokeWidth={2} />
              Extract from All Images
            </button>
          </div>
        </div>
      );
    }

    // NOTHING SELECTED → Global Document Styles
    const styles = project?.styles ?? {};
    return (
      <div className="px-4 py-4">
        <div className="mb-6">
          <SectionLabel>Canvas Tone</SectionLabel>
          <div className="flex items-center gap-2">
            {([
              { key: 'studio', label: 'White', color: '#FFFFFF' },
              { key: 'linen', label: 'Warm', color: '#F5F2EB' },
              { key: 'obsidian', label: 'Dark', color: '#121212' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => patchStyles({ canvasTone: t.key })}
                title={t.label}
                className={`flex-1 h-10 rounded-lg transition-all ring-offset-2 ring-offset-surface ${styles.canvasTone === t.key || (!styles.canvasTone && t.key === 'studio') ? 'ring-2 ring-ink shadow-sm' : 'ring-1 ring-black/5 hover:ring-black/10'}`}
                style={{ background: t.color }}
              />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <SectionLabel>Corner Radius</SectionLabel>
          <SegmentedControl>
            {([0, 4, 8, 16, 24] as const).map(r => (
              <SegmentedPill key={r} active={(styles.cornerRadius ?? 8) === r} onClick={() => patchStyles({ cornerRadius: r })}>
                {r}
              </SegmentedPill>
            ))}
          </SegmentedControl>
        </div>

        <div className="mb-6">
          <SectionLabel>Grid Gap</SectionLabel>
          <SegmentedControl>
            <SegmentedPill active={(styles.gridGap ?? 0) === 0} onClick={() => patchStyles({ gridGap: 0 })}>None</SegmentedPill>
            <SegmentedPill active={(styles.gridGap ?? 0) === 8} onClick={() => patchStyles({ gridGap: 8 })}>Tight</SegmentedPill>
            <SegmentedPill active={(styles.gridGap ?? 0) === 16} onClick={() => patchStyles({ gridGap: 16 })}>Balanced</SegmentedPill>
            <SegmentedPill active={(styles.gridGap ?? 0) === 24} onClick={() => patchStyles({ gridGap: 24 })}>Airy</SegmentedPill>
          </SegmentedControl>
        </div>

        <div className="mb-6">
          <SectionLabel>Margin</SectionLabel>
          <SegmentedControl>
            {([0, 16, 24, 32, 48] as const).map(m => (
              <SegmentedPill key={m} active={(styles.margin ?? 0) === m} onClick={() => patchStyles({ margin: m })}>
                {m === 0 ? 'None' : m}
              </SegmentedPill>
            ))}
          </SegmentedControl>
        </div>

        <div className="mb-6">
          <SectionLabel>Typography</SectionLabel>
          <SegmentedControl>
            <SegmentedPill active={(styles.fontPairing ?? 'sans') === 'sans'} onClick={() => patchStyles({ fontPairing: 'sans' })}>Sans</SegmentedPill>
            <SegmentedPill active={styles.fontPairing === 'serif'} onClick={() => patchStyles({ fontPairing: 'serif' })}>Serif</SegmentedPill>
            <SegmentedPill active={styles.fontPairing === 'mono'} onClick={() => patchStyles({ fontPairing: 'mono' })}>Mono</SegmentedPill>
          </SegmentedControl>
        </div>
      </div>
    );
  })();

  // ── Components Tab ────────────────────────────────────────────────────────

  const componentsTabContent = (
    <div className="px-4 py-4 grid grid-cols-2 gap-3">

      {/* Title Snapshot */}
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'title' }))}
        className="group flex flex-col gap-2 bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/50 group-hover:text-text-muted/70 transition-colors">Title</span>
        <div className="text-2xl font-extrabold text-ink leading-none tracking-tight">Ag</div>
      </div>

      {/* Subtitle Snapshot */}
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'subtitle' }))}
        className="group flex flex-col gap-2 bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/50 group-hover:text-text-muted/70 transition-colors">Subtitle</span>
        <div className="text-sm font-semibold text-text-muted leading-tight mt-auto">Section heading</div>
      </div>

      {/* Body Text Snapshot */}
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'text' }))}
        className="group flex flex-col gap-2 bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none col-span-2"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/50 group-hover:text-text-muted/70 transition-colors">Body Text</span>
        <div className="text-[10px] text-text-muted/70 leading-relaxed">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</div>
      </div>

      {/* Image Frame Snapshot */}
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'image' }))}
        className="group flex flex-col gap-2 bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/50 group-hover:text-text-muted/70 transition-colors">Image</span>
        <div className="h-10 bg-black/5 rounded-md flex items-center justify-center text-text-muted/30 group-hover:text-text-muted/50 transition-colors">
          <ImageIcon size={18} strokeWidth={2.5} />
        </div>
      </div>

      {/* Color Palette Snapshot */}
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'palette' }))}
        className="group flex flex-col gap-2 bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/50 group-hover:text-text-muted/70 transition-colors">Palette</span>
        <div className="flex gap-1 h-10">
          <div className="flex-1 bg-ink rounded-md shadow-sm" />
          <div className="flex-1 bg-surface-muted rounded-md shadow-sm" />
          <div className="flex-1 bg-text-muted/20 rounded-md shadow-sm" />
        </div>
      </div>

      {/* Bento Card Snapshot */}
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'card' }))}
        className="group flex flex-col gap-2 bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none col-span-2"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/50 group-hover:text-text-muted/70 transition-colors">Bento Card</span>
        <div className="flex gap-2 h-12">
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-black/5" />
          <div className="w-1/3 flex flex-col gap-2">
            <div className="flex-1 bg-white rounded-md shadow-sm border border-black/5" />
            <div className="flex-1 bg-white rounded-md shadow-sm border border-black/5" />
          </div>
        </div>
      </div>

      {/* Divider Snapshot */}
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'divider' }))}
        className="group flex flex-col gap-2 bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none col-span-2"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/50 group-hover:text-text-muted/70 transition-colors">Divider</span>
        <div className="h-4 flex items-center">
          <div className="w-full h-px bg-text-muted/30 group-hover:bg-text-muted/50 transition-colors" />
        </div>
      </div>

    </div>
  );

  // ── Assets Tab ────────────────────────────────────────────────────────────
  const assetsTabContent = (
    <div className="px-4 py-4 flex flex-col gap-4">
      <label className="flex flex-col items-center justify-center gap-2 p-6 bg-surface-muted/30 hover:bg-surface-muted/50 rounded-xl cursor-pointer transition-colors group">
        <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-text-muted group-hover:text-ink transition-colors">
          <Upload size={16} strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-semibold text-text-muted group-hover:text-ink transition-colors">Upload Image</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async e => {
            const files = Array.from(e.target.files ?? []);
            for (const file of files) {
              const normalized = await normalizeImage(file);
              const rec = await putImage({ projectId: id, styleGroupId: null, blob: normalized, source: 'upload' });
              setImages(prev => [...prev, rec]);
            }
          }}
        />
      </label>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {images.map(img => (
            <div
              key={img.id}
              draggable
              onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'image', content: img.id }))}
              className="aspect-square rounded-lg overflow-hidden bg-surface-muted cursor-grab active:cursor-grabbing ring-1 ring-black/5 hover:ring-2 hover:ring-ink hover:ring-offset-1 transition-all"
            >
              <img src={objectUrlFor(img.id, img.blob)} className="w-full h-full object-cover pointer-events-none" alt="" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-text-muted/60 text-center py-8">Project asset library is empty</div>
      )}
    </div>
  );

  // ── Right Sidebar Assembly ─────────────────────────────────────────────────
  const inspectorTabs: { id: 'design' | 'components' | 'assets'; icon: React.ReactNode; title: string }[] = [
    { id: 'design', icon: <SlidersHorizontal size={16} strokeWidth={activeInspectorTab === 'design' ? 2.5 : 2} />, title: 'Design' },
    { id: 'components', icon: <LayoutGrid size={16} strokeWidth={activeInspectorTab === 'components' ? 2.5 : 2} />, title: 'Components' },
    { id: 'assets', icon: <ImageIcon size={16} strokeWidth={activeInspectorTab === 'assets' ? 2.5 : 2} />, title: 'Assets' },
  ];

  const rightSidebarJsx = (
    <div className="flex flex-col h-full w-full">
      {/* Tab Bar (Pill style) */}
      <div className="flex items-center bg-surface-muted/50 p-1 rounded-lg mx-3 mt-3 mb-1 shrink-0">
        {inspectorTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveInspectorTab(tab.id)}
            title={tab.title}
            className={`flex-1 flex items-center justify-center py-2 rounded-md transition-all duration-200 ${activeInspectorTab === tab.id
              ? 'bg-white text-ink shadow-sm ring-1 ring-black/5'
              : 'text-text-muted hover:text-ink hover:bg-black/5'
              }`}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        {activeInspectorTab === 'design' && designTabContent}
        {activeInspectorTab === 'components' && componentsTabContent}
        {activeInspectorTab === 'assets' && assetsTabContent}
      </div>
    </div>
  );


  const overviewJsx = (
    <div className="flex-1 overflow-y-auto scrollbar-hover p-8 bg-surface-muted/30 h-full">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 pb-12">
          {pages.map((p, i) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 relative group"
            >
              {/* Drop Indicator */}
              {dragOverIndex === i && (
                <div className="absolute -left-5 top-0 bottom-6 w-1 bg-accent rounded-full z-10" />
              )}
              {dragOverIndex === pages.length && i === pages.length - 1 && (
                <div className="absolute -right-5 top-0 bottom-6 w-1 bg-accent rounded-full z-10" />
              )}

              <div
                className="relative shadow-sm rounded overflow-hidden border border-surface-muted group-hover:border-accent group-hover:shadow-md transition-all bg-white cursor-grab active:cursor-grabbing"
                onClick={() => { setActivePageId(p.id); setViewMode('focus'); }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/ironstone-page', p.id);
                  e.dataTransfer.effectAllowed = 'move';

                  // Hide the drag image ghost slightly or just let browser handle
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';

                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  if (x < rect.width / 2) {
                    setDragOverIndex(i);
                  } else {
                    setDragOverIndex(i + 1);
                  }
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const targetIdx = dragOverIndex !== null ? dragOverIndex : i;
                  setDragOverIndex(null);

                  const draggedPageId = e.dataTransfer.getData('application/ironstone-page');
                  if (draggedPageId && draggedPageId !== p.id) {
                    const draggedIdx = pages.findIndex(pg => pg.id === draggedPageId);
                    const newPages = [...pages];
                    const [removed] = newPages.splice(draggedIdx, 1);
                    const adjustedTargetIdx = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
                    newPages.splice(adjustedTargetIdx, 0, removed);

                    const updatedPages = newPages.map((pg, idx) => ({ ...pg, order: idx }));
                    setPages(updatedPages);
                    updatedPages.forEach(pg => persistPage(pg));
                  }
                }}
              >
                <GridSurface
                  orientation={project.orientation}
                  styles={project.styles}
                  className="w-full pointer-events-none"
                  showGridOverlay={false}
                >
                  {p.blocks.map((b) => (
                    <div
                      key={b.id}
                      style={blockStyle(b, rows)}
                      className="pointer-events-none"
                    >
                      <EditorBlockContent block={b} />
                    </div>
                  ))}
                </GridSurface>
                <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors pointer-events-none" />

                {/* Hover actions inside the card like Canva */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-ink shadow-sm rounded border border-surface-muted/50 cursor-pointer" title="Duplicate"><Copy size={12} /></button>
                  {pages.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-danger shadow-sm rounded border border-surface-muted/50 cursor-pointer" title="Delete"><Trash2 size={12} /></button>
                  )}
                </div>
              </div>

              <div className="text-center">
                <span className="text-xs font-medium text-text-muted">{i + 1}</span>
              </div>
            </div>
          ))}

          {/* Add Page Button as a card */}
          <div
            onClick={addPage}
            className="flex flex-col gap-2 relative group"
          >
            <div className="relative rounded overflow-hidden border border-transparent bg-surface-muted/50 hover:bg-surface-active transition-all cursor-pointer flex items-center justify-center text-text-muted hover:text-ink" style={{ aspectRatio: project.orientation === 'landscape' ? '48/32' : '48/64' }}>
              <Plus size={24} strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const canvasJsx = (
    <>
      <section className="flex-1 overflow-auto scrollbar-hide" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="w-full px-3 md:px-5 lg:px-6 py-3 max-w-6xl mx-auto">




          {loading ? (
            <div className="flex items-center justify-center h-64 text-sm font-semibold text-text-muted">
              Loading canvas...
            </div>
          ) : activePage && (
            <div
              ref={surfaceRef}
              className="select-none"
              onDragOver={(e) => {
                e.preventDefault(); // enable drop
              }}
              onDrop={async (e) => {
                e.preventDefault();
                if (!activePage || !surfaceRef.current) return;
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/json'));
                  if (!data || !data.type) return;
                  const gridInner = surfaceRef.current.querySelector<HTMLElement>('[data-grid-inner]') || surfaceRef.current;
                  const rect = gridInner.getBoundingClientRect();
                  const cell = cellSize();
                  const id = Date.now().toString();

                  let w = 16;
                  let h = 4;
                  let content = '';
                  let blockData: Record<string, any> | undefined = undefined;

                  if (data.type === 'title') {
                    w = 24; h = 4; content = 'Untitled Moodboard';
                  } else if (data.type === 'subtitle') {
                    w = 20; h = 3; content = 'Visual Direction & Concepts';
                  } else if (data.type === 'text') {
                    w = 20; h = 6; content = 'Write project notes, mood references, or client direction...';
                  } else if (data.type === 'caption') {
                    w = 16; h = 2; content = 'FIG. 01 — RUNWAY DETAILS / SS26';
                  } else if (data.type === 'image') {
                    w = 16; h = 10; content = data.content || '';
                  } else if (data.type === 'card') {
                    w = 16; h = 8; content = '';
                  } else if (data.type === 'divider') {
                    w = 24; h = 1; content = '';
                  } else if (data.type === 'palette') {
                    w = 16; h = 4;
                    let colors = ['#111110', '#6E6C67', '#A09D96', '#E5E5E3', '#FAFAF9'];
                    const pageImageIds = new Set(activePage.blocks.filter(b => b.type === 'image' && b.content).map(b => b.content));
                    const pageBlobs = images.filter(img => pageImageIds.has(img.id)).map(i => i.blob);
                    if (pageBlobs.length > 0) {
                      colors = await extractPalette(pageBlobs, 5);
                    }
                    blockData = { colors, format: 'hex', layoutMode: 'auto' };
                  }

                  const x = Math.max(0, Math.min(COLS - w, Math.floor((e.clientX - rect.left) / cell.w)));
                  const y = Math.max(0, Math.min(rows - h, Math.floor((e.clientY - rect.top) / cell.h)));

                  const newBlock: Block = {
                    id,
                    type: data.type,
                    x, y, w, h,
                    content,
                    data: blockData,
                  };
                  persistPage({ ...activePage, blocks: [...activePage.blocks, newBlock] });
                  setSelectedId(id);
                } catch (err) {
                  // Not a JSON drag drop
                }
              }}
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.hasAttribute('data-grid-inner') ||
                  target.hasAttribute('data-grid-surface') ||
                  target.closest('svg') ||
                  target === e.currentTarget
                ) {
                  setSelectedId(null);
                  setEditingId(null);
                  window.getSelection()?.removeAllRanges();
                }
              }}
            >
              <GridSurface
                orientation={project.orientation}
                styles={project.styles}
                showGridOverlay={isInteracting}
                className="w-full"
              >
                <div className="absolute inset-0">
                  {activePage.blocks.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-text-muted text-sm font-semibold select-none text-center px-6">
                      <p>This page is empty.</p>
                      <p className="text-xs text-text-faint mt-1 font-normal">
                        Drag an image from your project collection or paste directly from clipboard (Ctrl+V).
                      </p>
                    </div>
                  )}

                  {activePage.blocks.map((b) => {
                    const selected = selectedId === b.id;
                    const editing = editingId === b.id;
                    const isZen = viewMode === 'zen';

                    return (
                      <div
                        key={b.id}
                        style={blockStyle(b, rows)}
                        onPointerDown={(e) => onBlockPointerDown(e, b)}
                        onDoubleClick={() => {
                          if (b.type === 'title' || b.type === 'subtitle' || b.type === 'text' || b.type === 'caption') {
                            setEditingId(b.id);
                            setSelectedId(b.id);
                          } else if (b.type === 'image') {
                            setPickerBlockId(b.id);
                            setSelectedId(b.id);
                          }
                        }}
                        className={`${selected ? 'z-20' : 'z-10'} ${editing
                          ? 'cursor-text'
                          : 'cursor-grab active:cursor-grabbing'
                          }`}
                      >
                        <div className="relative w-full h-full">
                          {/* Active Bounding Box (Clean Figma-grade 1.5px border, zero ring-offset) */}
                          {selected && (
                            <div
                              className={`absolute inset-0 border-[1.5px] ${
                                editing ? 'border-[#0D99FF]/40 border-dashed' : 'border-[#0D99FF]'
                              } pointer-events-none z-20 transition-colors`}
                            />
                          )}

                          {/* Block Content */}
                          {b.type === 'title' || b.type === 'subtitle' || b.type === 'text' || b.type === 'caption' ? (
                            <InlineTextEditor
                              block={b}
                              isEditing={editing}
                              isSelected={selected}
                              onCommit={(newContent) => commitText(b, newContent)}
                              onTypeChange={(newType) => {
                                if (!activePage) return;
                                updateBlock(activePage.id, { ...b, type: newType });
                              }}
                              onStyleChange={(stylePatch) => {
                                if (!activePage) return;
                                updateBlock(activePage.id, { ...b, style: { ...b.style, ...stylePatch } });
                              }}
                              onStartEditing={() => {
                                setEditingId(b.id);
                                setSelectedId(b.id);
                              }}
                              onStopEditing={() => {
                                setEditingId(null);
                              }}
                            />
                          ) : (
                            <EditorBlockContent block={b} onSwatchClick={(idx, e) => { e.stopPropagation(); setPaletteEditState({ block: b, index: idx, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }); }} />
                          )}

                          {/* Modern Minimal Figma-Style Selection Handles (4 Square Corner Anchors + Edge Zones) */}
                          {selected && !editing && (
                            <>
                              {/* NW Corner Square Handle */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'nw')}
                                className="absolute -top-[3.5px] -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-[#0D99FF] rounded-[0.5px] cursor-nwse-resize z-30 shadow-xs hover:scale-125 transition-transform"
                              />
                              {/* NE Corner Square Handle */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'ne')}
                                className="absolute -top-[3.5px] -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-[#0D99FF] rounded-[0.5px] cursor-nesw-resize z-30 shadow-xs hover:scale-125 transition-transform"
                              />
                              {/* SE Corner Square Handle */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'se')}
                                className="absolute -bottom-[3.5px] -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-[#0D99FF] rounded-[0.5px] cursor-nwse-resize z-30 shadow-xs hover:scale-125 transition-transform"
                              />
                              {/* SW Corner Square Handle */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'sw')}
                                className="absolute -bottom-[3.5px] -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-[#0D99FF] rounded-[0.5px] cursor-nesw-resize z-30 shadow-xs hover:scale-125 transition-transform"
                              />

                              {/* Edge Resize Hit Zones (Invisible, Zero Visual Clutter) */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'n')}
                                className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize z-25"
                              />
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 's')}
                                className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize z-25"
                              />
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'w')}
                                className="absolute -left-1 top-2 bottom-2 w-2 cursor-ew-resize z-25"
                              />
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'e')}
                                className="absolute -right-1 top-2 bottom-2 w-2 cursor-ew-resize z-25"
                              />

                              {/* Dimension Pill (Figma-grade floating badge) */}
                              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#0D99FF] text-white text-[10px] font-semibold font-mono tracking-tight px-1.5 py-0.5 rounded-[3px] shadow-sm pointer-events-none whitespace-nowrap z-30 select-none">
                                {Math.round(b.w * (surfaceRef.current ? surfaceRef.current.clientWidth / COLS : 20))} × {Math.round(b.h * (surfaceRef.current ? surfaceRef.current.clientHeight / rows : 20))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GridSurface>
            </div>
          )}


        </div>
        {paletteEditState && (
          <PalettePopover
            block={paletteEditState.block}
            initialIndex={paletteEditState.index}
            anchorRect={paletteEditState.rect}
            onClose={() => setPaletteEditState(null)}
            onChange={(newBlock) => {
              persistPage({ ...activePage!, blocks: activePage!.blocks.map(b => b.id === newBlock.id ? newBlock : b) });
              setPaletteEditState(prev => prev ? { ...prev, block: newBlock } : null);
            }}
          />
        )}
      </section>
    </>
  );

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#F5F5F5] overflow-hidden relative">
      {/* Mobile Degradation Banner */}
      <div className="lg:hidden bg-accent text-white px-4 py-2 text-xs font-semibold text-center shrink-0 z-50">
        Best experienced on desktop / tablet screen.
      </div>

      {/* Top Contextual Header */}
      <header className="h-14 bg-transparent flex items-center px-4 md:px-6 justify-between shrink-0 z-20">

        {/* Left: Back only */}
        <div className="flex items-center w-1/4 text-sm text-text-muted">
          <Link to={`/projects/${id}`} className="inline-flex items-center gap-2 hover:text-ink transition-colors font-semibold">
            <ArrowLeft size={16} strokeWidth={2} />
            <span className="truncate">{project.name}</span>
          </Link>
        </div>

        {/* Center: Panel toggles + Canvas name + View mode toggle */}
        <div className="flex-1 flex justify-center items-center gap-2 text-xs font-medium text-text-muted">
          {/* Left panel toggle */}
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className={`p-1 rounded transition-colors ${leftOpen ? 'text-ink bg-ink/10' : 'text-text-muted hover:text-ink hover:bg-ink/5'}`}
            title="Toggle Pages Panel"
          >
            <SidebarSimple size={15} weight={leftOpen ? 'fill' : 'regular'} />
          </button>
          {/* Right panel toggle (mirrored) */}
          <button
            onClick={() => setRightInspectorOpen(!rightInspectorOpen)}
            className={`p-1 rounded transition-colors ${rightInspectorOpen ? 'text-ink bg-ink/10' : 'text-text-muted hover:text-ink hover:bg-ink/5'}`}
            title="Toggle Inspector Panel"
            style={{ transform: 'scaleX(-1)' }}
          >
            <SidebarSimple size={15} weight={rightInspectorOpen ? 'fill' : 'regular'} />
          </button>

          <div className="w-px h-4 bg-surface-muted mx-0.5" />

          <span className="text-text-muted">{selectedId ? 'Block Properties' : 'Document Canvas'}</span>

          {!selectedId && (
            <div className="flex items-center bg-ink/5 rounded-md p-0.5 relative">
              {/* Sliding active pill */}
              <div
                className={`absolute inset-y-0.5 w-[26px] bg-white rounded-[4px] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${viewMode === 'overview' ? 'left-[28px]' : 'left-0.5'}`}
              />
              <button
                onClick={() => setViewMode('focus')}
                className={`relative w-[26px] h-[26px] flex items-center justify-center rounded-[4px] z-10 transition-colors duration-300 ${viewMode !== 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Focus View"
              >
                <FrameCorners size={13} weight={viewMode !== 'overview' ? 'fill' : 'regular'} />
              </button>
              <button
                onClick={() => setViewMode('overview')}
                className={`relative w-[26px] h-[26px] flex items-center justify-center rounded-[4px] z-10 transition-colors duration-300 ${viewMode === 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Grid Overview"
              >
                <SquaresFour size={13} weight={viewMode === 'overview' ? 'fill' : 'regular'} />
              </button>
            </div>
          )}
        </div>

        {/* Right: Present + Export */}
        <div className="flex items-center justify-end gap-2 w-1/4">
          <button
            onClick={() => {
              setViewMode('zen');
              document.documentElement.requestFullscreen().catch(err => console.log(err));
            }}
            className="p-2 text-text-muted hover:text-ink hover:bg-surface-active rounded transition flex items-center gap-2"
            title="Present Fullscreen"
          >
            <MonitorPlay size={16} strokeWidth={1.5} />
            <span className="text-xs font-semibold hidden md:inline">Present</span>
          </button>
          <Link to={`/projects/${id}/export`} className="btn-primary !py-1.5 !px-3 text-xs">
            Export
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden px-4 pb-4 md:px-4 md:pb-4">
        {/* Left Pages Sidebar */}
        <aside
          className={`shrink-0 bg-surface rounded-md shadow-sm border border-surface-muted/50 flex flex-col z-10 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${!isResizing ? '' : '!transition-none'}`}
          style={{ width: leftOpen ? leftWidth : 0, opacity: leftOpen ? 1 : 0 }}
        >
          {pagesListJsx}
        </aside>

        {/* Center Canvas */}
        {/* Left Resizer */}
        {leftOpen && (
          <div
            className="w-1.5 md:w-1.5 cursor-col-resize shrink-0 relative group flex items-center justify-center z-20"
            onPointerDown={(e) => { e.preventDefault(); setIsResizing('left'); }}
          >
            <div className="w-1 h-12 rounded-full bg-surface-muted/0 group-hover:bg-accent/50 transition-colors" />
          </div>
        )}

        {/* Center Canvas */}
        <section className="flex-1 min-w-[400px] overflow-auto scrollbar-hide bg-surface rounded-md shadow-sm border border-surface-muted/50 relative flex flex-col" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>


          {viewMode === 'overview' ? overviewJsx : canvasJsx}
        </section>

        {/* Right Inspector */}
        {/* Right Resizer */}
        {rightInspectorOpen && (
          <div
            className="w-1.5 md:w-1.5 cursor-col-resize shrink-0 relative group flex items-center justify-center z-20"
            onPointerDown={(e) => { e.preventDefault(); setIsResizing('right'); }}
          >
            <div className="w-1 h-12 rounded-full bg-surface-muted/0 group-hover:bg-accent/50 transition-colors" />
          </div>
        )}

        {/* Right Inspector */}
        <aside
          className={`shrink-0 bg-surface rounded-md shadow-sm border border-surface-muted/50 flex flex-col z-10 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${!isResizing ? '' : '!transition-none'}`}
          style={{ width: rightInspectorOpen ? rightWidth : 0, opacity: rightInspectorOpen ? 1 : 0 }}
        >
          <div className="w-full shrink-0 h-full overflow-hidden flex flex-col">
            {rightSidebarJsx}
          </div>
        </aside>
      </div>

      {paletteEditState && (
        <PalettePopover
          block={paletteEditState.block}
          initialIndex={paletteEditState.index}
          anchorRect={paletteEditState.rect}
          onClose={() => setPaletteEditState(null)}
          onChange={(newBlock) => {
            persistPage({ ...activePage!, blocks: activePage!.blocks.map(b => b.id === newBlock.id ? newBlock : b) });
            setPaletteEditState(prev => prev ? { ...prev, block: newBlock } : null);
          }}
        />
      )}

      {/* Image Picker Modal */}
      {pickerBlockId && activePage && (
        <Modal title="Select Image" onClose={() => setPickerBlockId(null)}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => { assignImage(pickerBlockId, img.id); setPickerBlockId(null); }}
                className="group relative aspect-square rounded-lg overflow-hidden bg-surface-muted border-[1.5px] border-surface-muted hover:border-accent transition-all focus:outline-none focus:ring-[1.5px] focus:ring-accent focus:ring-offset-2"
              >
                <img
                  src={objectUrlFor(img.id, img.blob)}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Check className="text-white drop-shadow-md" size={24} strokeWidth={2} />
                </div>
              </button>
            ))}
          </div>
          {images.length === 0 && (
            <p className="text-sm text-text-muted">This project has no images yet.</p>
          )}
        </Modal>
      )}

      {/* True Fullscreen Zen / Presentation Overlay */}
      {viewMode === 'zen' && (
        <div
          className="fixed inset-0 z-[99999] bg-[#0F0F0F] flex flex-col items-center justify-center overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX < rect.width / 2) navigateZen('prev');
            else navigateZen('next');
          }}
        >
          {zenMessage && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white/10 text-white backdrop-blur-md px-6 py-2 rounded-full text-sm font-bold z-50 animate-in fade-in slide-in-from-top-4 duration-300">
              {zenMessage}
            </div>
          )}
          <div
            className="w-[90vw] h-[90vh] bg-white flex items-center justify-center shadow-2xl transition-all duration-300 ease-out"
            style={{ aspectRatio: project.orientation === 'landscape' ? '48/32' : '48/64' }}
          >
            <GridSurface
              orientation={project.orientation}
              styles={project.styles}
              className="w-full h-full"
              showGridOverlay={false}
            >
              {activePage?.blocks.map((b) => (
                <div key={b.id} style={blockStyle(b, rows)} className="pointer-events-none">
                  <EditorBlockContent block={b} />
                </div>
              ))}
            </GridSurface>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[11px] font-bold tracking-widest uppercase flex items-center gap-8">
            <span className="hover:text-white transition-colors">← Prev</span>
            <span className="text-white/90">Slide {pages.findIndex(p => p.id === activePageId) + 1} of {pages.length}</span>
            <span className="hover:text-white transition-colors">Next →</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
              setViewMode('focus');
            }}
            className="absolute top-6 right-6 text-white/50 hover:text-white p-2 transition-colors z-50"
          >
            <span className="text-xs uppercase tracking-wider font-bold">Esc to Exit</span>
          </button>
        </div>
      )}
    </div>
  );
}

function EditorBlockContent({ block, onSwatchClick }: { block: Block, onSwatchClick?: (index: number, e: React.MouseEvent) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (block.type === 'image' && block.content) {
      getImage(block.content).then((rec) => {
        if (!cancelled && rec) setUrl(objectUrlFor(rec.id, rec.blob));
      });
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [block.type, block.content]);

  return <BlockStatic block={block} imageUrl={url} onSwatchClick={onSwatchClick} />;
}
