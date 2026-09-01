import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Maximize2, Columns, LayoutGrid, Type, Image as ImageIcon, Check, MousePointer2, Trash2, Copy, MonitorPlay, Grid2X2, AlignLeft, AlignCenter, AlignRight, Bold, Italic, CornerDownRight, Layers, GripHorizontal, Palette, ArrowLeft, PanelLeft, PanelRight, Layout } from 'lucide-react';
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
  const [activeInspectorTab, setActiveInspectorTab] = useState<'blocks' | 'assets' | 'styles' | 'presets'>('blocks');
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
      if (idx < pages.length - 1) setActivePageId(pages[idx+1].id);
      else showZenMessage("End of presentation");
    } else {
      if (idx > 0) setActivePageId(pages[idx-1].id);
      else showZenMessage("Start of presentation");
    }
  }, [pages, activePageId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (viewMode === 'zen') {
          if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
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
    updateBlock(activePage!.id, { ...block, content: text });
    setEditingId(null);
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-2 mt-2">
        <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase">
          Pages ({pages.length})
        </div>
        <button onClick={addPage} className="p-1 text-text-muted hover:text-ink hover:bg-surface-active rounded transition" title="Add Page">
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hover px-2 pb-4">
        {pages.map((p, i) => (
          <div
            key={p.id}
            onClick={() => {
              setActivePageId(p.id);
              setSelectedId(null);
              if (viewMode === 'overview') setViewMode('focus');
            }}
            className={`group relative cursor-pointer rounded-lg p-2 transition-all flex-shrink-0 ${activePageId === p.id && viewMode === 'focus' ? "bg-surface shadow-sm ring-[1.5px] ring-accent" : "hover:bg-surface/50"}`}
          >
            <div className="pointer-events-none rounded overflow-hidden shadow-sm border-[1.5px] border-surface-muted bg-white">
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

  const rightSidebarJsx = (
    <div className="flex flex-col h-full w-full">
      {/* 4-Tab Segmented Header */}
      <div className="flex items-center p-1.5 bg-surface-muted/50 rounded-lg mx-4 mt-4 mb-6 border-[1.5px] border-surface-muted">
        {[
          { id: 'blocks', icon: <LayoutGrid size={14} />, label: 'Blocks' },
          { id: 'assets', icon: <ImageIcon size={14} />, label: 'Assets' },
          { id: 'styles', icon: <Palette size={14} />, label: 'Styles' },
          { id: 'presets', icon: <Columns size={14} />, label: 'Presets' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveInspectorTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all gap-1 ${activeInspectorTab === tab.id ? 'bg-white text-ink shadow-sm ring-[1.5px] ring-surface-muted' : 'text-text-muted hover:text-ink'}`}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hover px-4 pb-6">
        {activeInspectorTab === 'blocks' && (
          <div className="flex flex-col gap-4">
            <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-2">Native Blocks</div>
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'palette' }))}
              className="card p-3 shadow-sm bg-surface flex flex-row items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition-all text-text-muted hover:text-ink select-none"
            >
              <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-muted rounded-md text-ink"><Palette size={14} strokeWidth={1.5} /></div>
              <span className="text-sm font-semibold">Color Palette</span>
            </div>
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'text' }))}
              className="card p-3 shadow-sm bg-surface flex flex-row items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition-all text-text-muted hover:text-ink select-none"
            >
              <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-muted rounded-md text-ink"><Type size={14} strokeWidth={1.5} /></div>
              <span className="text-sm font-semibold">Text Heading</span>
            </div>
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'bentoCard' }))}
              className="card p-3 shadow-sm bg-surface flex flex-row items-center gap-3 cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition-all text-text-muted hover:text-ink select-none"
            >
              <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-surface-muted rounded-md text-ink"><Layers size={14} strokeWidth={1.5} /></div>
              <span className="text-sm font-semibold">Bento Frame</span>
            </div>
          </div>
        )}

        {activeInspectorTab === 'assets' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase">Project Assets ({images.length})</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {images.map(img => (
                <div 
                  key={img.id} 
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'image', content: img.id }))}
                  className="aspect-square rounded-md overflow-hidden bg-surface border-[1.5px] border-surface-muted cursor-grab active:cursor-grabbing hover:ring-[1.5px] ring-accent transition"
                >
                  <img src={objectUrlFor(img.id, img.blob)} className="w-full h-full object-cover pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeInspectorTab === 'styles' && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-3">Global Styles</div>
              <p className="text-xs text-text-muted">Document-wide visual settings (Coming in Phase 24).</p>
            </div>
          </div>
        )}

        {activeInspectorTab === 'presets' && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-3">Layout Presets</div>
              <p className="text-xs text-text-muted">Intelligent auto-layout engines (Coming in Phase 25).</p>
            </div>
          </div>
        )}
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
                  <button onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-ink shadow-sm rounded border border-surface-muted/50 cursor-pointer" title="Duplicate"><Copy size={12}/></button>
                  {pages.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removePage(p.id); }} className="p-1.5 bg-white/90 text-text-muted hover:text-danger shadow-sm rounded border border-surface-muted/50 cursor-pointer" title="Delete"><Trash2 size={12}/></button>
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
      <section className="flex-1 overflow-auto" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="w-full px-6 md:px-10 lg:px-12 py-6 max-w-6xl mx-auto">
          {/* Canvas Selection Controls */}
            <div className="flex items-center justify-end mb-6 h-8">
              {selectedId && (
                <button className="btn-secondary !py-1.5" onClick={removeSelected}>
                  <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    <Trash2 size={16} strokeWidth={1.5} />
                  </div>
                  Remove block
                </button>
              )}
            </div>

          

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
                  if (data.type === 'palette') {
                    const rect = surfaceRef.current.getBoundingClientRect();
                    const cell = cellSize();
                    const margin = project.styles?.margin ?? 24;
                    const x = Math.max(0, Math.min(COLS - 16, Math.floor((e.clientX - rect.left - margin) / cell.w)));
                    const y = Math.max(0, Math.min(rows - 4, Math.floor((e.clientY - rect.top - margin) / cell.h)));

                    const id = Date.now().toString();
                    
                    let colors = ['#111110', '#6E6C67', '#A09D96', '#E5E5E3', '#FAFAF9'];
                    const pageImageIds = new Set(activePage.blocks.filter(b => b.type === 'image' && b.content).map(b => b.content));
                    const pageBlobs = images.filter(img => pageImageIds.has(img.id)).map(i => i.blob);
                    
                    if (pageBlobs.length > 0) {
                      colors = await extractPalette(pageBlobs, 5);
                    }
                    
                    const newBlock: Block = {
                      id,
                      type: 'palette',
                      x, y,
                      w: 16, h: 4,
                      content: '',
                      data: { colors, format: 'hex', layoutMode: 'auto' }
                    };
                    persistPage({ ...activePage, blocks: [...activePage.blocks, newBlock] });
                  }
                } catch(err) {
                  // Not a JSON drag drop
                }
              }}
              onPointerDown={(e) => {
                if (
                  (e.target as HTMLElement).hasAttribute('data-grid-inner') ||
                  (e.target as HTMLElement).hasAttribute('data-grid-surface')
                ) {
                  setSelectedId(null);
                  setEditingId(null);
                }
              }}
            >
              <GridSurface
                orientation={project.orientation}
                styles={project.styles}
                showGridOverlay={isInteracting}
                className="w-full shadow-lift rounded-md"
              >
                <div className="absolute inset-0" data-grid-inner>
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
                          if (b.type === 'title' || b.type === 'subtitle' || b.type === 'text') {
                            setEditingId(b.id);
                            setSelectedId(b.id);
                          } else if (b.type === 'image') {
                            setPickerBlockId(b.id);
                            setSelectedId(b.id);
                          }
                        }}
                        className={`${selected ? 'z-20' : 'z-10'} ${
                          b.type === 'title' || b.type === 'subtitle' || b.type === 'text'
                            ? 'cursor-text'
                            : 'cursor-grab active:cursor-grabbing'
                        }`}
                      >
                        <div className="relative w-full h-full">
                          {/* Active Bounding Ring */}
                          {selected && (
                            <div className="absolute inset-0 ring-[1.5px] ring-accent ring-offset-[1.5px] rounded-[var(--block-radius,8px)] pointer-events-none z-20" />
                          )}

                          {/* Block Content */}
                          {editing ? (
                            <textarea
                              autoFocus
                              defaultValue={b.content}
                              onBlur={(e) => commitText(b, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') commitText(b, (e.target as HTMLTextAreaElement).value);
                              }}
                              className={`w-full h-full bg-white/90 outline-none resize-none rounded-[var(--block-radius,8px)] p-2 z-30 relative ${
                                b.type === 'title'
                                  ? 'font-extrabold tracking-tight text-[5cqw] leading-none'
                                  : b.type === 'subtitle'
                                  ? 'font-semibold text-[2.4cqw] text-text-muted'
                                  : 'text-[1.8cqw] leading-relaxed'
                              }`}
                            />
                          ) : (
                            <EditorBlockContent block={b} onSwatchClick={(idx, e) => { e.stopPropagation(); setPaletteEditState({ block: b, index: idx, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }); }} />
                          )}

                          {/* 8-Point Interactive Resize Handles */}
                          {selected && !editing && (
                            <>
                              {/* NW */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'nw')}
                                className="absolute -top-1 -left-1 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-nwse-resize z-30 shadow-sm"
                              />
                              {/* N */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'n')}
                                className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-ns-resize z-30 shadow-sm"
                              />
                              {/* NE */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'ne')}
                                className="absolute -top-1 -right-1 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-nesw-resize z-30 shadow-sm"
                              />
                              {/* E */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'e')}
                                className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-ew-resize z-30 shadow-sm"
                              />
                              {/* SE */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'se')}
                                className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-nwse-resize z-30 shadow-sm"
                              />
                              {/* S */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 's')}
                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-ns-resize z-30 shadow-sm"
                              />
                              {/* SW */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'sw')}
                                className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-nesw-resize z-30 shadow-sm"
                              />
                              {/* W */}
                              <div
                                data-resize-handle
                                onPointerDown={(e) => onResizePointerDown(e, b, 'w')}
                                className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-white border-[1.25px] border-accent rounded-full cursor-ew-resize z-30 shadow-sm"
                              />
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

          {/* Color Palette Strip */}
          {viewMode !== 'zen' && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold text-text-muted">Color Palette</p>
                <button
                  className="btn-ghost !px-2 !py-1 text-xs"
                  disabled={paletteBusy}
                  onClick={() => generatePalette('project')}
                >
                  {paletteBusy ? 'Extracting...' : 'From all images'}
                </button>
                <button
                  className="btn-ghost !px-2 !py-1 text-xs"
                  disabled={paletteBusy}
                  onClick={() => generatePalette('page')}
                >
                  From this page
                </button>
              </div>
              {palette.length > 0 && (
                <div className="flex items-center gap-2">
                  {palette.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => addSwatch(hex)}
                      title={`Add ${hex} to page`}
                      className="group relative w-12 h-12 rounded-md shadow-sm transition hover:scale-105"
                      style={{ backgroundColor: hex }}
                    >
                      <span className="absolute inset-x-0 -bottom-5 text-center text-[10px] font-semibold text-text-faint opacity-0 group-hover:opacity-100 transition">
                        {hex}
                      </span>
                    </button>
                  ))}
                  <p className="ml-2 text-xs text-text-faint">Click a swatch to add it to the page.</p>
                </div>
              )}
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
    <div className="flex flex-col h-full min-h-screen bg-[#EBEBEB] overflow-hidden relative">
      {/* Mobile Degradation Banner */}
      <div className="lg:hidden bg-accent text-white px-4 py-2 text-xs font-semibold text-center shrink-0 z-50">
        Best experienced on desktop / tablet screen.
      </div>

      {/* Top Contextual Header */}
      <header className="h-14 bg-transparent flex items-center px-4 md:px-6 justify-between shrink-0 z-20">
        {/* Left: Back + Left panel toggle + Right panel toggle */}
        <div className="flex items-center gap-1.5 text-sm text-text-muted w-1/4">
          <Link to={`/projects/${id}`} className="inline-flex items-center gap-2 hover:text-ink transition-colors font-semibold mr-2">
            <ArrowLeft size={16} strokeWidth={2} />
            <span className="truncate">{project.name}</span>
          </Link>
          {/* Left panel toggle */}
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className={`p-1 rounded transition-colors ${leftOpen ? 'text-ink bg-ink/10' : 'text-text-muted hover:text-ink hover:bg-ink/5'}`}
            title="Toggle Pages Panel"
          >
            <PanelLeft size={14} strokeWidth={leftOpen ? 2.5 : 1.75} />
          </button>
          {/* Right panel toggle */}
          <button
            onClick={() => setRightInspectorOpen(!rightInspectorOpen)}
            className={`p-1 rounded transition-colors ${rightInspectorOpen ? 'text-ink bg-ink/10' : 'text-text-muted hover:text-ink hover:bg-ink/5'}`}
            title="Toggle Inspector Panel"
          >
            <PanelRight size={14} strokeWidth={rightInspectorOpen ? 2.5 : 1.75} />
          </button>
        </div>

        {/* Center: Canvas name + Focus/Overview morphing toggle */}
        <div className="flex-1 flex justify-center items-center gap-4 text-xs font-medium text-text-muted">
          <span>{selectedId ? "Block Properties" : "Document Canvas"}</span>
          {!selectedId && (
            <div className="flex items-center bg-ink/5 rounded-md p-0.5 relative">
              <div
                className={`absolute inset-y-0.5 w-[26px] bg-white rounded-[4px] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${viewMode === 'overview' ? 'left-[28px]' : 'left-0.5'}`}
              />
              <button
                onClick={() => setViewMode('focus')}
                className={`relative w-[26px] h-[26px] flex items-center justify-center rounded-[4px] transition-colors duration-300 z-10 ${viewMode !== 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Focus View"
              >
                <Layout size={11} strokeWidth={viewMode !== 'overview' ? 2.5 : 1.75} />
              </button>
              <button
                onClick={() => setViewMode('overview')}
                className={`relative w-[26px] h-[26px] flex items-center justify-center rounded-[4px] transition-colors duration-300 z-10 ${viewMode === 'overview' ? 'text-ink' : 'text-text-muted hover:text-ink'}`}
                title="Grid Overview"
              >
                <LayoutGrid size={11} strokeWidth={viewMode === 'overview' ? 2.5 : 1.75} />
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

      <div className="flex flex-1 overflow-hidden px-2 pb-2 md:px-4 md:pb-4">
        {/* Left Pages Sidebar */}
        <aside 
          className={`shrink-0 bg-surface rounded-xl shadow-sm border border-surface-muted/50 flex flex-col z-10 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${!isResizing ? '' : '!transition-none'}`}
          style={{ width: leftOpen ? leftWidth : 0, opacity: leftOpen ? 1 : 0 }}
        >
          {pagesListJsx}
        </aside>

        {/* Center Canvas */}
        {/* Left Resizer */}
        {leftOpen && (
          <div 
            className="w-3 md:w-4 cursor-col-resize shrink-0 relative group flex items-center justify-center z-20"
            onPointerDown={(e) => { e.preventDefault(); setIsResizing('left'); }}
          >
            <div className="w-1 h-12 rounded-full bg-surface-muted/0 group-hover:bg-accent/50 transition-colors" />
          </div>
        )}
        
        {/* Center Canvas */}
        <section className="flex-1 min-w-[400px] overflow-auto scrollbar-hover bg-surface rounded-xl shadow-sm border border-surface-muted/50 relative flex flex-col" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          

          {viewMode === 'overview' ? overviewJsx : canvasJsx}
        </section>

        {/* Right Inspector */}
        {/* Right Resizer */}
        {rightInspectorOpen && (
          <div 
            className="w-3 md:w-4 cursor-col-resize shrink-0 relative group flex items-center justify-center z-20"
            onPointerDown={(e) => { e.preventDefault(); setIsResizing('right'); }}
          >
            <div className="w-1 h-12 rounded-full bg-surface-muted/0 group-hover:bg-accent/50 transition-colors" />
          </div>
        )}
        
        {/* Right Inspector */}
        <aside 
          className={`shrink-0 bg-surface rounded-xl shadow-sm border border-surface-muted/50 flex flex-col z-10 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${!isResizing ? '' : '!transition-none'}`}
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
              if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
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
