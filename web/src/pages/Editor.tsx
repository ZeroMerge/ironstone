import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Maximize2, Minimize2, Columns, Type, Image as ImageIcon, Check, MousePointer2, Trash2, Copy, MonitorPlay, Grid2X2, AlignLeft, AlignCenter, AlignRight, Bold, Italic, CornerDownRight, Layers, GripHorizontal, Palette, ArrowLeft, ArrowRight, LayoutGrid, SlidersHorizontal, ArrowUp, ArrowDown, Upload, Wand2, Crop, ChevronLeft, ChevronRight, ChevronDown, X, Download, Printer, FileText, CheckCircle2, AlertCircle, Loader2, Mail, Undo2, Redo2, Pipette } from 'lucide-react';
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
  getSettings,
  saveEmail,
} from '../db/repo';
import { extractPalette } from '../lib/palette';
import { blobToDataUrl } from '../lib/images';
import { startExport, getExportStatus } from '../lib/api';
import PalettePopover from '../editor/PalettePopover';
import StudioStyleBar from '../editor/StudioStyleBar';
import CropOverlay from '../editor/CropOverlay';
import type { Block, ImageRec, Page, Project, ProjectStyles, ExportPayload } from '../lib/types';
import { applyAutoLayout, type LayoutEngineType, type LayoutScope } from '../lib/layoutEngine';
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
  | { 
      mode: 'move'; 
      blockId: string; 
      startX: number; 
      startY: number; 
      origX: number; 
      origY: number;
      group?: { id: string; origX: number; origY: number }[];
    }
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

function resolvePushCollisions(movingBlock: Block, allBlocks: Block[], maxRows: number): Block[] {
  const result = allBlocks.map((b) => (b.id === movingBlock.id ? movingBlock : { ...b }));
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 8) {
    changed = false;
    iterations++;
    for (const b of result) {
      if (b.id === movingBlock.id) continue;
      const overlapX = !(movingBlock.x + movingBlock.w <= b.x || b.x + b.w <= movingBlock.x);
      const overlapY = !(movingBlock.y + movingBlock.h <= b.y || b.y + b.h <= movingBlock.y);
      if (overlapX && overlapY) {
        const newY = Math.min(maxRows - b.h, movingBlock.y + movingBlock.h);
        if (newY !== b.y) {
          b.y = newY;
          changed = true;
        }
      }
    }
  }
  return result;
}

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;
  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIds(id ? [id] : []);
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'focus' | 'overview' | 'zen'>('focus');
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'design' | 'components' | 'assets' | 'layout'>('layout');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [zenMessage, setZenMessage] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(224);
  const [rightWidth, setRightWidth] = useState(288);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [layoutScope, setLayoutScope] = useState<LayoutScope>('active');
  const [customPageCount, setCustomPageCount] = useState<number>(2);
  const [layoutSeed, setLayoutSeed] = useState<number>(0);
  const [activeEngine, setActiveEngine] = useState<LayoutEngineType>('bento');
  const [physicsMode, setPhysicsMode] = useState<'free' | 'swap' | 'push'>('free');
  const [isLayoutRunning, setIsLayoutRunning] = useState<boolean>(false);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [croppingBlockId, setCroppingBlockId] = useState<string | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const marqueeStartRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Canva-Style Export Dropdown Popup State
  const [exportOpen, setExportOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [exportFileName, setExportFileName] = useState('');
  const [exportPageScope, setExportPageScope] = useState<'all' | 'current' | 'custom'>('all');
  const [customSelectedPages, setCustomSelectedPages] = useState<string[]>([]);
  const [exportPhase, setExportPhase] = useState<
    | { kind: 'idle' }
    | { kind: 'submitting'; step: string }
    | { kind: 'processing'; jobId: string; note?: string }
    | { kind: 'done'; downloadUrl?: string | null }
    | { kind: 'failed'; message: string }
  >({ kind: 'idle' });
  const exportPollRef = useRef<number | null>(null);

  useEffect(() => {
    if (project?.name && !exportFileName) {
      setExportFileName(project.name);
    }
  }, [project?.name]);

  useEffect(() => {
    if (!exportOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [exportOpen]);

  // 30-Step Undo / Redo History Stack
  interface HistoryStep {
    pages: Page[];
    styles?: ProjectStyles;
  }
  const [historyStack, setHistoryStack] = useState<HistoryStep[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const pushHistory = useCallback((newPages: Page[], newStyles?: ProjectStyles) => {
    setHistoryStack(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      const snapshot: HistoryStep = {
        pages: JSON.parse(JSON.stringify(newPages)),
        styles: newStyles ? { ...newStyles } : undefined,
      };
      const updated = [...sliced, snapshot];
      if (updated.length > 30) updated.shift();
      return updated;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0 && historyStack.length > 0) {
      const prevStep = historyStack[historyIndex - 1];
      setPages(prevStep.pages);
      if (prevStep.styles && project) {
        patchStyles(prevStep.styles);
      }
      setHistoryIndex(historyIndex - 1);
      prevStep.pages.forEach(p => void putPage(p));
    }
  }, [historyIndex, historyStack, project]);

  const redo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const nextStep = historyStack[historyIndex + 1];
      setPages(nextStep.pages);
      if (nextStep.styles && project) {
        patchStyles(nextStep.styles);
      }
      setHistoryIndex(historyIndex + 1);
      nextStep.pages.forEach(p => void putPage(p));
    }
  }, [historyIndex, historyStack, project]);

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

  const zenTimerRef = useRef<any>(null);
  const [zenHudVisible, setZenHudVisible] = useState(true);
  const zenIdleTimerRef = useRef<any>(null);

  const showZenMessage = useCallback((msg: string) => {
    setZenMessage(msg);
    if (zenTimerRef.current) clearTimeout(zenTimerRef.current);
    zenTimerRef.current = setTimeout(() => setZenMessage(null), 2000);
  }, []);

  const handleZenPointerMove = useCallback(() => {
    setZenHudVisible(true);
    if (zenIdleTimerRef.current) clearTimeout(zenIdleTimerRef.current);
    zenIdleTimerRef.current = setTimeout(() => {
      setZenHudVisible(false);
    }, 2500);
  }, []);

  const exitPresentation = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setViewMode('focus');
  }, []);

  const navigateZen = useCallback((direction: 'next' | 'prev') => {
    const idx = pages.findIndex(p => p.id === activePageId);
    if (direction === 'next') {
      if (idx < pages.length - 1) setActivePageId(pages[idx + 1].id);
      else showZenMessage("End of presentation");
    } else {
      if (idx > 0) setActivePageId(pages[idx - 1].id);
      else showZenMessage("Start of presentation");
    }
  }, [pages, activePageId, showZenMessage]);

  // Fullscreen change listener: auto exit zen mode if browser exits fullscreen
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement && viewMode === 'zen') {
        setViewMode('focus');
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [viewMode]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (viewMode === 'zen') {
        if (e.key === 'Escape') {
          e.preventDefault();
          exitPresentation();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') {
          e.preventDefault();
          navigateZen('next');
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
          e.preventDefault();
          navigateZen('prev');
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          if (pages.length > 0) setActivePageId(pages[0].id);
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          if (pages.length > 0) setActivePageId(pages[pages.length - 1].id);
          return;
        }
      } else {
        if (e.key === 'Escape') {
          setRightInspectorOpen(false);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, navigateZen, pages, exitPresentation]);

  // Keyboard shortcut: Delete selected block
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Undo / Redo Shortcuts (Ctrl+Z, Cmd+Z, Ctrl+Y, Cmd+Shift+Z)
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === 'y') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement | null;
        if (
          editingId ||
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable ||
          target?.closest('[contenteditable="true"]') ||
          target?.closest('input') ||
          target?.closest('textarea')
        ) {
          return;
        }
        if (selectedIds.length === 0 || !activePageId) return;
        setPages((prev) => {
          const pg = prev.find((p) => p.id === activePageId);
          if (!pg) return prev;
          const updated = { ...pg, blocks: pg.blocks.filter((b) => !selectedIds.includes(b.id)) };
          persistPage(updated);
          setSelectedIds([]);
          const newPages = prev.map((p) => (p.id === activePageId ? updated : p));
          pushHistory(newPages, project?.styles);
          return newPages;
        });
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingId(null);
      }
      // Figma Pattern: Enter key activates text editing on selected text block
      if (e.key === 'Enter') {
        if (editingId) return;
        if (!selectedId || !activePageId) return;
        const pg = pages.find((p) => p.id === activePageId);
        const b = pg?.blocks.find((x) => x.id === selectedId);
        if (b && (b.type === 'title' || b.type === 'subtitle' || b.type === 'text' || b.type === 'caption')) {
          e.preventDefault();
          setEditingId(b.id);
        }
      }
      // Figma Pattern: Arrow keys nudge selected block on grid
      if (e.key.startsWith('Arrow')) {
        if (editingId) return;
        if (!selectedId || !activePageId) return;
        const pg = pages.find((p) => p.id === activePageId);
        const b = pg?.blocks.find((x) => x.id === selectedId);
        if (!b) return;
        e.preventDefault();
        const step = e.shiftKey ? 4 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        const next = clampBlock({ ...b, x: b.x + dx, y: b.y + dy }, rows);
        if (next.x !== b.x || next.y !== b.y) {
          const updated = { ...pg!, blocks: pg!.blocks.map((x) => (x.id === b.id ? next : x)) };
          setPages((prev) => prev.map((p) => (p.id === activePageId ? updated : p)));
          void putPage(updated);
        }
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
    if ((e.target as HTMLElement).closest('[data-action-pill]')) return;

    e.preventDefault();
    e.stopPropagation();

    // Shift-click toggles selection
    let nextSelectedIds: string[];
    if (e.shiftKey) {
      nextSelectedIds = selectedIds.includes(block.id)
        ? selectedIds.filter((id) => id !== block.id)
        : [...selectedIds, block.id];
    } else {
      nextSelectedIds = selectedIds.includes(block.id) ? selectedIds : [block.id];
    }
    setSelectedIds(nextSelectedIds);

    // Capture starting coordinates for multi-block drag
    const targets = nextSelectedIds.includes(block.id) && nextSelectedIds.length > 1
      ? nextSelectedIds
      : [block.id];

    const groupOrig = activePage?.blocks
      .filter((b) => targets.includes(b.id))
      .map((b) => ({ id: b.id, origX: b.x, origY: b.y })) || [];

    dragRef.current = {
      mode: 'move',
      blockId: block.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: block.x,
      origY: block.y,
      group: groupOrig,
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

      if (drag.group && drag.group.length > 1) {
        // Multi-block synchronous movement
        setPages((prev) =>
          prev.map((p) => {
            if (p.id !== activePage.id) return p;
            const updated = p.blocks.map((b) => {
              const item = drag.group?.find((g) => g.id === b.id);
              if (item) {
                return clampBlock({ ...b, x: item.origX + dx, y: item.origY + dy }, rows);
              }
              return b;
            });
            return { ...p, blocks: updated };
          })
        );
      } else {
        const next = clampBlock({ ...block, x: drag.origX + dx, y: drag.origY + dy }, rows);

        // Physics Mode 1: Drag-to-Swap
        if (physicsMode === 'swap') {
          const centerX = next.x + next.w / 2;
          const centerY = next.y + next.h / 2;
          const target = activePage.blocks.find(
            (b) =>
              b.id !== block.id &&
              centerX >= b.x &&
              centerX < b.x + b.w &&
              centerY >= b.y &&
              centerY < b.y + b.h
          );
          setSwapTargetId(target ? target.id : null);
          if (next.x !== block.x || next.y !== block.y) {
            setPages((prev) =>
              prev.map((p) =>
                p.id === activePage.id
                  ? { ...p, blocks: p.blocks.map((b) => (b.id === block.id ? next : b)) }
                  : p
              )
            );
          }
        } else if (physicsMode === 'push') {
          // Physics Mode 2: Collision Push Mechanics
          const resolved = resolvePushCollisions(next, activePage.blocks, rows);
          setPages((prev) =>
            prev.map((p) => (p.id === activePage.id ? { ...p, blocks: resolved } : p))
          );
        } else {
          // Physics Mode 3: Free placement
          if (next.x !== block.x || next.y !== block.y) {
            setPages((prev) =>
              prev.map((p) =>
                p.id === activePage.id
                  ? { ...p, blocks: p.blocks.map((b) => (b.id === block.id ? next : b)) }
                  : p
              )
            );
          }
        }
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
      if (physicsMode === 'swap' && swapTargetId && drag.mode === 'move') {
        const targetBlock = activePage.blocks.find((b) => b.id === swapTargetId);
        if (targetBlock) {
          const blockAOrig = { x: drag.origX, y: drag.origY };
          const blockBOrig = { x: targetBlock.x, y: targetBlock.y };
          setPages((prev) =>
            prev.map((p) => {
              if (p.id !== activePage.id) return p;
              const updated = p.blocks.map((b) => {
                if (b.id === drag.blockId) return { ...b, x: blockBOrig.x, y: blockBOrig.y };
                if (b.id === swapTargetId) return { ...b, x: blockAOrig.x, y: blockAOrig.y };
                return b;
              });
              const pg = { ...p, blocks: updated };
              void putPage(pg);
              pushHistory(prev.map((item) => (item.id === pg.id ? pg : item)), project?.styles);
              return pg;
            })
          );
        }
        setSwapTargetId(null);
      } else {
        const current = pages.find((p) => p.id === activePage.id);
        if (current) {
          void putPage(current);
          pushHistory(pages, project?.styles);
        }
      }
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
    pushHistory(pages, updated.styles);
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

    // CARD BLOCK
    if (selectedBlock && selectedBlock.type === 'card') {
      const caption = selectedBlock.data?.caption ?? 'FIG. 01 — ARCHIVAL REFERENCE / SS26';
      const padding = selectedBlock.data?.padding ?? 8;
      const radius = selectedBlock.style?.borderRadius ?? (project?.styles?.cornerRadius ?? 8);
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-6">
            <SectionLabel>Caption Text</SectionLabel>
            <input
              type="text"
              value={caption}
              onChange={e => patchBlockData({ caption: e.target.value })}
              className="w-full bg-surface-muted/40 border border-surface-muted rounded-lg px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-accent"
              placeholder="Enter caption..."
            />
          </div>
          <div className="mb-6">
            <SectionLabel>Sub-Padding</SectionLabel>
            <SegmentedControl>
              {[4, 8, 12, 16].map(p => (
                <SegmentedPill key={p} active={padding === p} onClick={() => patchBlockData({ padding: p })}>
                  {p}px
                </SegmentedPill>
              ))}
            </SegmentedControl>
          </div>
          <div className="mb-6">
            <SectionLabel>Corner Radius — {radius}px</SectionLabel>
            <div className="bg-surface-muted/30 p-3 rounded-lg">
              <input
                type="range"
                min={0}
                max={32}
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
            {selectedBlock.content ? 'Change Card Image' : 'Select Card Image'}
          </button>
        </div>
      );
    }

    // EDITORIAL QUOTE BLOCK
    if (selectedBlock && selectedBlock.type === 'quote') {
      const quoteText = selectedBlock.content || '';
      const author = selectedBlock.data?.author || '';
      const source = selectedBlock.data?.source || '';
      const quoteStyle = selectedBlock.data?.quoteStyle || 'serif';
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-6">
            <SectionLabel>Quote Text</SectionLabel>
            <textarea
              rows={4}
              value={quoteText}
              onChange={e => {
                if (!activePage) return;
                updateBlock(activePage.id, { ...selectedBlock, content: e.target.value });
              }}
              className="w-full bg-surface-muted/40 border border-surface-muted rounded-lg px-3 py-2 text-xs font-serif italic text-ink focus:outline-none focus:border-accent resize-none"
              placeholder="Type quote here..."
            />
          </div>
          <div className="mb-6">
            <SectionLabel>Author Attribution</SectionLabel>
            <input
              type="text"
              value={author}
              onChange={e => patchBlockData({ author: e.target.value })}
              className="w-full bg-surface-muted/40 border border-surface-muted rounded-lg px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-accent"
              placeholder="e.g. Dieter Rams"
            />
          </div>
          <div className="mb-6">
            <SectionLabel>Source / Citation</SectionLabel>
            <input
              type="text"
              value={source}
              onChange={e => patchBlockData({ source: e.target.value })}
              className="w-full bg-surface-muted/40 border border-surface-muted rounded-lg px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-accent"
              placeholder="e.g. Ten Principles"
            />
          </div>
          <div className="mb-6">
            <SectionLabel>Typographic Style</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={quoteStyle === 'serif'} onClick={() => patchBlockData({ quoteStyle: 'serif' })}>
                Serif
              </SegmentedPill>
              <SegmentedPill active={quoteStyle === 'sans'} onClick={() => patchBlockData({ quoteStyle: 'sans' })}>
                Sans
              </SegmentedPill>
            </SegmentedControl>
          </div>
        </div>
      );
    }

    // STUDIO SPEC SHEET BLOCK
    if (selectedBlock && selectedBlock.type === 'specSheet') {
      const client = selectedBlock.data?.client ?? 'STUDIO ACNE';
      const date = selectedBlock.data?.date ?? '2026.04.12';
      const season = selectedBlock.data?.season ?? 'FW / 2026';
      const projectCode = selectedBlock.data?.projectCode ?? 'IRN-SPEC-09';
      const leadDesigner = selectedBlock.data?.leadDesigner ?? 'M. BORSCHE';
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-4">
            <SectionLabel>Spec Sheet Fields</SectionLabel>
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted">Client</label>
                <input
                  type="text"
                  value={client}
                  onChange={e => patchBlockData({ client: e.target.value })}
                  className="w-full bg-surface-muted/40 border border-surface-muted rounded-md px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-accent mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted">Date</label>
                <input
                  type="text"
                  value={date}
                  onChange={e => patchBlockData({ date: e.target.value })}
                  className="w-full bg-surface-muted/40 border border-surface-muted rounded-md px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-accent mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted">Season</label>
                <input
                  type="text"
                  value={season}
                  onChange={e => patchBlockData({ season: e.target.value })}
                  className="w-full bg-surface-muted/40 border border-surface-muted rounded-md px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-accent mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted">Project Code</label>
                <input
                  type="text"
                  value={projectCode}
                  onChange={e => patchBlockData({ projectCode: e.target.value })}
                  className="w-full bg-surface-muted/40 border border-surface-muted rounded-md px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-accent mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted">Lead Designer</label>
                <input
                  type="text"
                  value={leadDesigner}
                  onChange={e => patchBlockData({ leadDesigner: e.target.value })}
                  className="w-full bg-surface-muted/40 border border-surface-muted rounded-md px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-accent mt-0.5"
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // MOOD TAG BLOCK
    if (selectedBlock && selectedBlock.type === 'moodTag') {
      const tags: string[] = selectedBlock.data?.tags ?? ['#Brutalism', '#FW26', '#Editorial'];
      const style = selectedBlock.data?.style ?? 'filled';
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-6">
            <SectionLabel>Active Tags</SectionLabel>
            <div className="flex flex-wrap gap-1.5 p-2 bg-surface-muted/20 border border-surface-muted rounded-lg mb-3">
              {tags.map((t, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-muted text-xs font-mono text-ink">
                  {t}
                  <button
                    onClick={() => patchBlockData({ tags: tags.filter((_, i) => i !== idx) })}
                    className="hover:text-red-500 font-bold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="new-tag-input"
                type="text"
                placeholder="Add tag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    const val = input.value.trim();
                    if (val) {
                      const formatted = val.startsWith('#') ? val : `#${val}`;
                      if (!tags.includes(formatted)) {
                        patchBlockData({ tags: [...tags, formatted] });
                      }
                      input.value = '';
                    }
                  }
                }}
                className="flex-1 bg-surface-muted/40 border border-surface-muted rounded-lg px-3 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-accent"
              />
              <button
                onClick={() => {
                  const el = document.getElementById('new-tag-input') as HTMLInputElement;
                  if (el && el.value.trim()) {
                    const val = el.value.trim();
                    const formatted = val.startsWith('#') ? val : `#${val}`;
                    if (!tags.includes(formatted)) {
                      patchBlockData({ tags: [...tags, formatted] });
                    }
                    el.value = '';
                  }
                }}
                className="btn-primary !py-1 !px-3 text-xs"
              >
                Add
              </button>
            </div>
          </div>
          <div className="mb-6">
            <SectionLabel>Tag Style</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={style === 'filled'} onClick={() => patchBlockData({ style: 'filled' })}>
                Filled
              </SegmentedPill>
              <SegmentedPill active={style === 'outline'} onClick={() => patchBlockData({ style: 'outline' })}>
                Outline
              </SegmentedPill>
            </SegmentedControl>
          </div>
        </div>
      );
    }

    // HAIRLINE DIVIDER BLOCK
    if (selectedBlock && selectedBlock.type === 'divider') {
      const style = selectedBlock.data?.style ?? 'solid';
      const opacity = selectedBlock.data?.opacity ?? 60;
      return (
        <div className="px-4 py-4">
          <BlockActions />
          <div className="mb-6">
            <SectionLabel>Line Style</SectionLabel>
            <SegmentedControl>
              <SegmentedPill active={style === 'solid'} onClick={() => patchBlockData({ style: 'solid' })}>
                Solid
              </SegmentedPill>
              <SegmentedPill active={style === 'dashed'} onClick={() => patchBlockData({ style: 'dashed' })}>
                Dashed
              </SegmentedPill>
              <SegmentedPill active={style === 'dotted'} onClick={() => patchBlockData({ style: 'dotted' })}>
                Dotted
              </SegmentedPill>
            </SegmentedControl>
          </div>
          <div className="mb-6">
            <SectionLabel>Opacity — {opacity}%</SectionLabel>
            <div className="bg-surface-muted/30 p-3 rounded-lg">
              <input
                type="range"
                min={10}
                max={100}
                value={opacity}
                onChange={e => patchBlockData({ opacity: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </div>
          </div>
        </div>
      );
    }

    // NOTHING SELECTED → Studio Canvas Controls & Global Document Styles
    const styles = project?.styles ?? {};
    return (
      <div className="px-4 py-4 space-y-5 select-none">
        {/* Studio Quick Actions: History & Eyedropper */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-muted/60">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-ink">Studio Controls</span>
            <span className="text-[10px] text-text-muted">Canvas & Document Settings</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md hover:bg-surface-muted disabled:opacity-30 text-text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= historyStack.length - 1}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded-md hover:bg-surface-muted disabled:opacity-30 text-text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <Redo2 size={14} />
            </button>
            {'EyeDropper' in window && (
              <button
                onClick={async () => {
                  try {
                    const eyeDropper = new (window as any).EyeDropper();
                    const result = await eyeDropper.open();
                    if (result?.sRGBHex && activePage) {
                      const paletteBlock = activePage.blocks.find(b => b.type === 'palette');
                      if (paletteBlock) {
                        const colors = paletteBlock.data?.colors || ['#111110', '#8C8983', '#E6E4DF', '#FFFFFF'];
                        if (!colors.includes(result.sRGBHex)) {
                          const updated = {
                            ...paletteBlock,
                            data: { ...paletteBlock.data, colors: [...colors.slice(0, 5), result.sRGBHex] }
                          };
                          updateBlock(activePage.id, updated);
                        }
                      }
                    }
                  } catch (e) {}
                }}
                title="Pick Color from Screen"
                className="p-1.5 rounded-md hover:bg-surface-muted text-text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <Pipette size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Kinetic Drag Physics Mode */}
        <div>
          <SectionLabel>Drag Interaction Physics</SectionLabel>
          <SegmentedControl>
            <SegmentedPill active={physicsMode === 'free'} onClick={() => setPhysicsMode('free')}>
              Free
            </SegmentedPill>
            <SegmentedPill active={physicsMode === 'swap'} onClick={() => setPhysicsMode('swap')}>
              Swap
            </SegmentedPill>
            <SegmentedPill active={physicsMode === 'push'} onClick={() => setPhysicsMode('push')}>
              Push
            </SegmentedPill>
          </SegmentedControl>
        </div>

        {/* Canvas Tone */}
        <div>
          <SectionLabel>Canvas Tone</SectionLabel>
          <div className="flex items-center gap-2">
            {([
              { key: 'studio', label: 'White', color: '#FAFAF9' },
              { key: 'linen', label: 'Warm Linen', color: '#F6F4EE' },
              { key: 'slate', label: 'Cool Grey', color: '#ECEBE8' },
              { key: 'obsidian', label: 'Obsidian', color: '#111110' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => patchStyles({ canvasTone: t.key })}
                title={t.label}
                className={`flex-1 h-9 rounded-lg transition-all ring-offset-2 ring-offset-surface cursor-pointer ${
                  (styles.canvasTone ?? 'studio') === t.key
                    ? 'ring-2 ring-ink shadow-sm'
                    : 'ring-1 ring-black/10 hover:ring-black/20'
                }`}
                style={{ background: t.color }}
              />
            ))}
          </div>
        </div>

        {/* Corner Radius */}
        <div>
          <SectionLabel>Corner Radius</SectionLabel>
          <SegmentedControl>
            {([0, 4, 8, 16, 24] as const).map(r => (
              <SegmentedPill key={r} active={(styles.cornerRadius ?? 8) === r} onClick={() => patchStyles({ cornerRadius: r })}>
                {r}px
              </SegmentedPill>
            ))}
          </SegmentedControl>
        </div>

        {/* Grid Gap */}
        <div>
          <SectionLabel>Grid Gap</SectionLabel>
          <SegmentedControl>
            <SegmentedPill active={(styles.gridGap ?? 8) === 0} onClick={() => patchStyles({ gridGap: 0 })}>None</SegmentedPill>
            <SegmentedPill active={(styles.gridGap ?? 8) === 8} onClick={() => patchStyles({ gridGap: 8 })}>Tight (8px)</SegmentedPill>
            <SegmentedPill active={(styles.gridGap ?? 8) === 16} onClick={() => patchStyles({ gridGap: 16 })}>Balanced (16px)</SegmentedPill>
            <SegmentedPill active={(styles.gridGap ?? 8) === 24} onClick={() => patchStyles({ gridGap: 24 })}>Airy (24px)</SegmentedPill>
          </SegmentedControl>
        </div>

        {/* Margin */}
        <div>
          <SectionLabel>Page Margin</SectionLabel>
          <SegmentedControl>
            {([0, 16, 24, 32, 48] as const).map(m => (
              <SegmentedPill key={m} active={(styles.margin ?? 24) === m} onClick={() => patchStyles({ margin: m })}>
                {m === 0 ? 'None' : `${m}px`}
              </SegmentedPill>
            ))}
          </SegmentedControl>
        </div>

        {/* Typography */}
        <div>
          <SectionLabel>Typography System</SectionLabel>
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
    <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/70">Canvas Blocks</span>
        <p className="text-[11px] text-text-faint">Drag any block onto the 48×32 canvas grid.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {/* Title */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'title' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Title</span>
          <div className="text-xl font-extrabold text-ink leading-none tracking-tight my-1.5">Headline</div>
          <span className="text-[9px] text-text-faint">24×4 Header</span>
        </div>

        {/* Subtitle */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'subtitle' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Subtitle</span>
          <div className="text-xs font-semibold text-text-muted leading-tight my-1.5 truncate">Section Direction</div>
          <span className="text-[9px] text-text-faint">20×3 Horizon</span>
        </div>

        {/* Body Text */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'text' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none col-span-2"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Body Text</span>
          <div className="text-[10px] text-text-muted/70 leading-relaxed my-1">
            Write project notes, conceptual references, or studio notes inline.
          </div>
          <span className="text-[9px] text-text-faint">20×6 Flexible Column</span>
        </div>

        {/* Image Frame */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'image' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Image Frame</span>
          <div className="h-10 bg-black/5 rounded-md flex items-center justify-center text-text-muted/40 my-1">
            <ImageIcon size={18} strokeWidth={2} />
          </div>
          <span className="text-[9px] text-text-faint">16×12 Visual Cell</span>
        </div>

        {/* Card Block */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'card' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Card Block</span>
          <div className="h-10 bg-white rounded-md border border-black/5 flex flex-col p-1 gap-1 my-1">
            <div className="flex-1 bg-surface-active/80 rounded-[2px]" />
            <div className="h-1 w-3/4 bg-text-muted/30 rounded-full" />
          </div>
          <span className="text-[9px] text-text-faint">Image + Caption Unit</span>
        </div>

        {/* Editorial Quote */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'quote' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Quote Block</span>
          <div className="my-1 flex items-start gap-1">
            <span className="text-lg font-serif italic text-accent leading-none">“</span>
            <span className="text-[10px] font-serif italic text-ink/80 line-clamp-2">Good design is as little design...</span>
          </div>
          <span className="text-[9px] text-text-faint">20×8 Editorial Callout</span>
        </div>

        {/* Studio Spec Sheet */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'specSheet' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Spec Sheet</span>
          <div className="my-1 flex flex-col gap-0.5 font-mono text-[8px] text-text-muted">
            <div className="flex justify-between border-b border-black/5 pb-0.5"><span>CLIENT</span><span className="text-ink font-semibold">STUDIO</span></div>
            <div className="flex justify-between"><span>SEASON</span><span className="text-ink font-semibold">FW26</span></div>
          </div>
          <span className="text-[9px] text-text-faint">18×10 Metadata Table</span>
        </div>

        {/* Mood Tags */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'moodTag' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Mood Tags</span>
          <div className="my-1 flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 rounded-full bg-surface-active text-[8px] font-mono text-ink">#Brutal</span>
            <span className="px-1.5 py-0.5 rounded-full bg-surface-active text-[8px] font-mono text-ink">#FW26</span>
          </div>
          <span className="text-[9px] text-text-faint">18×5 Pill Badges</span>
        </div>

        {/* Hairline Divider */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'divider' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Hairline Divider</span>
          <div className="h-6 flex items-center justify-center my-1">
            <div className="w-full h-px bg-ink/40 group-hover:bg-ink transition-colors" />
          </div>
          <span className="text-[9px] text-text-faint">1px Accent Rule</span>
        </div>

        {/* Color Palette */}
        <div
          draggable
          onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'palette' }))}
          className="group flex flex-col justify-between bg-surface-muted/30 hover:bg-surface-muted/60 p-3 rounded-xl cursor-grab active:cursor-grabbing border border-surface-muted/40 transition-all select-none col-span-2"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted/60">Color Palette</span>
          <div className="flex gap-1 h-8 my-1 rounded-md overflow-hidden border border-black/5">
            <div className="flex-1 bg-[#111110]" />
            <div className="flex-1 bg-[#6E6C67]" />
            <div className="flex-1 bg-[#A09D96]" />
            <div className="flex-1 bg-[#E5E5E3]" />
            <div className="flex-1 bg-[#FAFAF9]" />
          </div>
          <span className="text-[9px] text-text-faint">16×4 Dynamic Swatches</span>
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

  const handleAutoLayout = async (engine: LayoutEngineType = activeEngine, incrementSeed = true) => {
    if (!activePage || !project) return;
    setIsLayoutRunning(true);
    setActiveEngine(engine);
    const nextSeed = incrementSeed ? layoutSeed + 1 : layoutSeed;
    if (incrementSeed) setLayoutSeed(nextSeed);

    try {
      if (layoutScope === 'all') {
        const updatedPages: Page[] = [];
        for (let i = 0; i < pages.length; i++) {
          const p = pages[i];
          const res = await applyAutoLayout({
            engineType: engine,
            blocks: p.blocks,
            images,
            rows,
            seed: nextSeed + i * 3,
            scope: 'active',
          });
          if (res.length > 0) {
            updatedPages.push({ ...res[0], id: p.id, projectId: id, order: p.order });
          } else {
            updatedPages.push(p);
          }
        }
        setPages(updatedPages);
        await Promise.all(updatedPages.map(p => putPage(p)));
        setIsLayoutRunning(false);
        return;
      }

      const res = await applyAutoLayout({
        engineType: engine,
        blocks: activePage.blocks,
        images,
        rows,
        seed: nextSeed,
        scope: layoutScope,
        customPages: customPageCount,
      });

      if (res.length > 0) {
        const first = { ...res[0], id: activePage.id, projectId: id, order: activePage.order };
        const rest = res.slice(1).map((p, idx) => ({
          ...p,
          id: uid(),
          projectId: id,
          order: activePage.order + idx + 1,
        }));

        setPages(prev => {
          const idx = prev.findIndex(p => p.id === activePage.id);
          if (idx === -1) return prev;
          const copy = [...prev];
          copy.splice(idx, 1, first, ...rest);
          Promise.all([putPage(first), ...rest.map(p => putPage(p))]);
          pushHistory(copy, project?.styles);
          return copy;
        });
        setSelectedId(null);
        setEditingId(null);
      }
    } catch (e) {
      console.error('Auto layout execution error:', e);
    } finally {
      setIsLayoutRunning(false);
    }
  };

  const layoutTabContent = (
    <div className="px-4 py-4 flex flex-col gap-5 overflow-y-auto">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Auto-Layout Solver</h3>
        <p className="text-[11px] text-text-faint">
          Constraint bisection packing: dynamically arranges all blocks to fit page dimensions with harmonic proportions.
        </p>
      </div>

      {/* Scope Selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/70">Target Scope</span>
        <div className="flex items-center bg-surface-muted/50 p-1 rounded-lg gap-1">
          <button
            onClick={() => setLayoutScope('active')}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
              layoutScope === 'active' ? 'bg-white text-ink shadow-xs ring-1 ring-black/5 font-bold' : 'text-text-muted hover:text-ink'
            }`}
          >
            Active Page
          </button>
          <button
            onClick={() => setLayoutScope('custom')}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
              layoutScope === 'custom' ? 'bg-white text-ink shadow-xs ring-1 ring-black/5 font-bold' : 'text-text-muted hover:text-ink'
            }`}
          >
            Custom Pages
          </button>
          <button
            onClick={() => setLayoutScope('all')}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
              layoutScope === 'all' ? 'bg-white text-ink shadow-xs ring-1 ring-black/5 font-bold' : 'text-text-muted hover:text-ink'
            }`}
          >
            All Pages
          </button>
        </div>

        {layoutScope === 'custom' && (
          <div className="flex items-center justify-between bg-surface-muted/30 px-3 py-2 rounded-lg border border-surface-muted/40 mt-1">
            <span className="text-[11px] font-medium text-text-muted">Distribute across:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCustomPageCount(Math.max(1, customPageCount - 1))}
                className="w-6 h-6 rounded bg-surface-muted flex items-center justify-center text-ink hover:bg-surface-active text-xs font-bold"
              >
                -
              </button>
              <span className="font-mono font-bold text-xs w-6 text-center">{customPageCount}</span>
              <button
                onClick={() => setCustomPageCount(Math.min(10, customPageCount + 1))}
                className="w-6 h-6 rounded bg-surface-muted flex items-center justify-center text-ink hover:bg-surface-active text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preset Engines */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/70">Layout Presets</span>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handleAutoLayout('bento', false)}
            className={`flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left ${
              activeEngine === 'bento' ? 'bg-white border-accent shadow-xs ring-1 ring-accent' : 'bg-surface-muted/30 hover:bg-surface-muted border-surface-muted'
            }`}
          >
            <div className="w-full h-14 bg-white rounded border border-surface-muted/50 grid grid-cols-3 gap-1 p-1">
              <div className="col-span-2 row-span-2 bg-accent/15 rounded-xs" />
              <div className="bg-surface-active rounded-xs" />
              <div className="bg-surface-active rounded-xs" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-ink">Pinterest Bento</div>
              <div className="text-[10px] text-text-muted">Aspect-Ratio Masonry</div>
            </div>
          </button>

          <button
            onClick={() => handleAutoLayout('swiss', false)}
            className={`flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left ${
              activeEngine === 'swiss' ? 'bg-white border-accent shadow-xs ring-1 ring-accent' : 'bg-surface-muted/30 hover:bg-surface-muted border-surface-muted'
            }`}
          >
            <div className="w-full h-14 bg-white rounded border border-surface-muted/50 grid grid-cols-3 gap-1 p-1">
              <div className="bg-accent/15 rounded-xs h-full" />
              <div className="bg-surface-active rounded-xs h-full" />
              <div className="bg-surface-active rounded-xs h-full" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-ink">Swiss Strict</div>
              <div className="text-[10px] text-text-muted">3-Column Grid</div>
            </div>
          </button>

          <button
            onClick={() => handleAutoLayout('editorial', false)}
            className={`flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left ${
              activeEngine === 'editorial' ? 'bg-white border-accent shadow-xs ring-1 ring-accent' : 'bg-surface-muted/30 hover:bg-surface-muted border-surface-muted'
            }`}
          >
            <div className="w-full h-14 bg-white rounded border border-surface-muted/50 flex gap-1 p-1">
              <div className="w-2/3 h-full bg-accent/15 rounded-xs" />
              <div className="w-1/3 h-full flex flex-col gap-1">
                <div className="h-1/2 w-full bg-surface-active rounded-xs" />
                <div className="h-1/2 w-full bg-surface-active rounded-xs" />
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-ink">Editorial Hero</div>
              <div className="text-[10px] text-text-muted">60/40 Ratio</div>
            </div>
          </button>

          <button
            onClick={() => handleAutoLayout('dual')}
            className={`flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left ${
              activeEngine === 'dual' ? 'bg-white border-accent shadow-xs ring-1 ring-accent' : 'bg-surface-muted/30 hover:bg-surface-muted border-surface-muted'
            }`}
          >
            <div className="w-full h-14 bg-white rounded border border-surface-muted/50 grid grid-cols-2 gap-1 p-1">
              <div className="bg-accent/15 rounded-xs h-full" />
              <div className="bg-accent/15 rounded-xs h-full" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-ink">Dual Feature</div>
              <div className="text-[10px] text-text-muted">Symmetric Pair</div>
            </div>
          </button>
        </div>
      </div>

      {/* Reroll Button */}
      <button
        onClick={() => handleAutoLayout(activeEngine, true)}
        disabled={isLayoutRunning}
        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mt-1 shadow-sm"
      >
        <Wand2 size={16} strokeWidth={2} className={isLayoutRunning ? 'animate-spin' : ''} />
        <span className="text-sm font-semibold">{isLayoutRunning ? 'Arranging Grid...' : '✨ Re-roll Layout'}</span>
      </button>
    </div>
  );

  // ── Canva-Style Export Pipeline Functions ─────────────────────────────────
  async function triggerExport() {
    if (!project) return;

    setExportPhase({ kind: 'submitting', step: 'Packaging pages…' });

    try {
      const allPages = await listPages(project.id);
      const allImages = await listProjectImages(project.id);

      // Determine which pages to export based on exportPageScope
      let targetPages = allPages;
      if (exportPageScope === 'current') {
        targetPages = allPages.filter(p => p.id === activePageId);
        if (targetPages.length === 0 && allPages.length > 0) {
          targetPages = [allPages[0]];
        }
      } else if (exportPageScope === 'custom') {
        targetPages = allPages.filter(p => customSelectedPages.includes(p.id));
        if (targetPages.length === 0) {
          targetPages = allPages;
        }
      }

      const payload: ExportPayload = {
        project: {
          ...project,
          name: exportFileName.trim() || project.name || 'Moodboard',
        },
        pages: targetPages,
        images: await Promise.all(
          allImages.map(async (img) => ({
            id: img.id,
            dataUrl: await blobToDataUrl(img.blob),
          }))
        ),
        palette: project.palette ?? [],
        styles: project.styles,
        format: project.orientation === 'portrait' ? 'a4-portrait' : 'a4-landscape',
      };

      setExportPhase({ kind: 'submitting', step: 'Generating vector PDF…' });

      const { jobId } = await startExport(payload);
      setExportPhase({ kind: 'processing', jobId, note: 'Rendering…' });

      pollExport(jobId);
    } catch (err) {
      setExportPhase({
        kind: 'failed',
        message: err instanceof Error ? err.message : 'Export failed. Please try again.',
      });
    }
  }

  function pollExport(jobId: string) {
    const tick = async () => {
      try {
        const status = await getExportStatus(jobId);
        if (status.status === 'done') {
          if (status.downloadUrl) {
            const a = document.createElement('a');
            a.href = `http://localhost:4100${status.downloadUrl}`;
            const safeName = (exportFileName.trim() || project?.name || 'moodboard').replace(/[^a-zA-Z0-9_-]/g, '_');
            a.download = `${safeName}.pdf`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          setExportPhase({ kind: 'done', downloadUrl: status.downloadUrl });
          return;
        }
        if (status.status === 'failed') {
          setExportPhase({
            kind: 'failed',
            message: status.error || 'PDF generation failed.',
          });
          return;
        }
        setExportPhase({
          kind: 'processing',
          jobId,
          note: 'Rendering PDF…',
        });
        exportPollRef.current = window.setTimeout(tick, 1200);
      } catch (err) {
        setExportPhase({
          kind: 'failed',
          message: err instanceof Error ? err.message : 'Export server connection lost.',
        });
      }
    };
    exportPollRef.current = window.setTimeout(tick, 800);
  }

  const exportDropdownJsx = (
    <div
      ref={exportDropdownRef}
      className="fixed top-16 right-4 sm:right-6 w-[340px] sm:w-[360px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-80px)] overflow-y-auto !bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] p-5 z-[9999] flex flex-col gap-4 text-[#111110] select-none animate-in fade-in zoom-in-95 duration-150 scrollbar-hover"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[#111110]">Download</span>
        <button
          onClick={() => setExportOpen(false)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#8C8983] hover:text-[#111110] hover:bg-[#F5F5F3] transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* File Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-[#8C8983]">File name</label>
        <input
          type="text"
          value={exportFileName}
          onChange={(e) => setExportFileName(e.target.value)}
          placeholder={project?.name || 'Moodboard'}
          className="w-full px-3 py-2 text-xs rounded-xl bg-[#F5F5F3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 text-[#111110] font-medium transition-all"
        />
      </div>

      {/* File Type Display */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-[#8C8983]">File type</label>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#F5F5F3]">
          <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <FileText size={13} strokeWidth={2.2} />
          </div>
          <span className="text-xs font-semibold text-[#111110]">PDF Document</span>
        </div>
      </div>

      {/* Select Pages (Canva Style) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-[#8C8983]">Select pages</label>
          {exportPageScope === 'custom' && (
            <button
              onClick={() => {
                if (customSelectedPages.length === pages.length) {
                  setCustomSelectedPages([]);
                } else {
                  setCustomSelectedPages(pages.map(p => p.id));
                }
              }}
              className="text-[10px] font-medium text-accent hover:underline cursor-pointer"
            >
              {customSelectedPages.length === pages.length ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>

        {/* 3-Way Segmented Control */}
        <div className="flex items-center bg-[#F5F5F3] p-1 rounded-xl">
          <button
            onClick={() => setExportPageScope('all')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              exportPageScope === 'all'
                ? 'bg-white text-[#111110] shadow-sm'
                : 'text-[#8C8983] hover:text-[#111110]'
            }`}
          >
            All ({pages.length})
          </button>

          <button
            onClick={() => setExportPageScope('current')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              exportPageScope === 'current'
                ? 'bg-white text-[#111110] shadow-sm'
                : 'text-[#8C8983] hover:text-[#111110]'
            }`}
          >
            This page ({pages.findIndex(p => p.id === activePageId) + 1 || 1})
          </button>

          <button
            onClick={() => {
              setExportPageScope('custom');
              if (customSelectedPages.length === 0) {
                setCustomSelectedPages(pages.map(p => p.id));
              }
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              exportPageScope === 'custom'
                ? 'bg-white text-[#111110] shadow-sm'
                : 'text-[#8C8983] hover:text-[#111110]'
            }`}
          >
            <span>Custom</span>
            <ChevronDown size={11} className={exportPageScope === 'custom' ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>

        {/* Custom Page Picker Grid */}
        {exportPageScope === 'custom' && (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pt-1 max-h-36 overflow-y-auto scrollbar-hover pr-1">
            {pages.map((p, idx) => {
              const isSelected = customSelectedPages.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setCustomSelectedPages(prev =>
                      prev.includes(p.id)
                        ? prev.filter(id => id !== p.id)
                        : [...prev, p.id]
                    );
                  }}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent/10 text-accent font-bold ring-2 ring-accent'
                      : 'bg-[#F5F5F3] text-[#8C8983] hover:bg-[#EBEBEA] hover:text-[#111110]'
                  }`}
                >
                  <span className="text-xs font-mono font-bold">{idx + 1}</span>
                  <span className="text-[9px] truncate max-w-[48px]">Page {idx + 1}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Area */}
      {exportPhase.kind === 'idle' && (
        <button
          onClick={triggerExport}
          disabled={exportPageScope === 'custom' && customSelectedPages.length === 0}
          className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent/90 active:scale-[0.99] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent/20 transition-all cursor-pointer disabled:opacity-40"
        >
          <Download size={14} strokeWidth={2.2} />
          <span>Download</span>
        </button>
      )}

      {(exportPhase.kind === 'submitting' || exportPhase.kind === 'processing') && (
        <div className="w-full py-2.5 px-4 rounded-xl bg-accent/10 text-accent font-semibold text-xs flex items-center justify-center gap-2">
          <Loader2 size={15} className="animate-spin" />
          <span>{exportPhase.kind === 'submitting' ? exportPhase.step : 'Rendering PDF…'}</span>
        </div>
      )}

      {exportPhase.kind === 'done' && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 font-semibold text-xs flex items-center justify-center gap-2">
            <Check size={14} strokeWidth={3} />
            <span>Downloaded!</span>
          </div>
          <button
            onClick={() => setExportPhase({ kind: 'idle' })}
            className="text-[11px] text-[#8C8983] hover:text-[#111110] transition-colors cursor-pointer"
          >
            Download again
          </button>
        </div>
      )}

      {exportPhase.kind === 'failed' && (
        <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-red-500/10 text-red-600 text-center">
          <span className="text-xs font-semibold">Export Failed</span>
          <span className="text-[10px] text-red-700">{exportPhase.message}</span>
          <button
            onClick={() => setExportPhase({ kind: 'idle' })}
            className="text-[10px] text-[#111110] underline font-medium mt-0.5 cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );


  // ── Right Sidebar Assembly ─────────────────────────────────────────────────
  const inspectorTabs: { id: 'design' | 'components' | 'assets' | 'layout'; icon: React.ReactNode; title: string }[] = [
    { id: 'design', icon: <SlidersHorizontal size={16} strokeWidth={activeInspectorTab === 'design' ? 2.5 : 2} />, title: 'Design' },
    { id: 'components', icon: <LayoutGrid size={16} strokeWidth={activeInspectorTab === 'components' ? 2.5 : 2} />, title: 'Components' },
    { id: 'assets', icon: <ImageIcon size={16} strokeWidth={activeInspectorTab === 'assets' ? 2.5 : 2} />, title: 'Assets' },
    { id: 'layout', icon: <Wand2 size={16} strokeWidth={activeInspectorTab === 'layout' ? 2.5 : 2} />, title: 'Auto-Layout' },
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
        {activeInspectorTab === 'layout' && layoutTabContent}
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
      <section 
        className="flex-1 overflow-auto scrollbar-hide" 
        onPointerMove={(e) => {
          onPointerMove(e);
          if (marqueeStartRef.current) {
            const dx = e.clientX - marqueeStartRef.current.clientX;
            const dy = e.clientY - marqueeStartRef.current.clientY;
            if (Math.hypot(dx, dy) > 5) {
              const x1 = Math.min(e.clientX, marqueeStartRef.current.clientX);
              const y1 = Math.min(e.clientY, marqueeStartRef.current.clientY);
              const x2 = Math.max(e.clientX, marqueeStartRef.current.clientX);
              const y2 = Math.max(e.clientY, marqueeStartRef.current.clientY);
              setMarqueeBox({ x1, y1, x2, y2 });

              // Hit test with page blocks
              const hitIds: string[] = [];
              activePage?.blocks.forEach((b) => {
                const el = document.getElementById(`block-${b.id}`);
                if (el) {
                  const r = el.getBoundingClientRect();
                  const hit = !(x2 < r.left || r.right < x1 || y2 < r.top || r.bottom < y1);
                  if (hit) hitIds.push(b.id);
                }
              });
              setSelectedIds(hitIds);
            }
          }
        }} 
        onPointerUp={(e) => {
          onPointerUp();
          if (marqueeStartRef.current) {
            marqueeStartRef.current = null;
            setMarqueeBox(null);
          }
        }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('[data-block="true"]') && !target.closest('[data-text-toolbar="true"]') && !target.closest('[data-action-pill="true"]')) {
            setSelectedIds([]);
            setEditingId(null);
            setCroppingBlockId(null);
            window.getSelection()?.removeAllRanges();
            marqueeStartRef.current = { clientX: e.clientX, clientY: e.clientY };
          }
        }}
      >
        {/* Marquee Selection Rectangle */}
        {marqueeBox && (
          <div
            className="fixed pointer-events-none z-50 border border-accent bg-accent/15 rounded-xs"
            style={{
              left: marqueeBox.x1,
              top: marqueeBox.y1,
              width: marqueeBox.x2 - marqueeBox.x1,
              height: marqueeBox.y2 - marqueeBox.y1,
            }}
          />
        )}

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
                    w = 16; h = 12; content = data.content || '';
                  } else if (data.type === 'card') {
                    w = 16; h = 14; content = data.content || '';
                    blockData = { caption: 'FIG. 01 — ARCHIVAL REFERENCE / SS26', padding: 8 };
                  } else if (data.type === 'quote') {
                    w = 20; h = 8; content = 'Good design is as little design as possible.';
                    blockData = { author: 'Dieter Rams', source: 'Ten Principles for Good Design', quoteStyle: 'serif' };
                  } else if (data.type === 'specSheet') {
                    w = 18; h = 10; content = '';
                    blockData = { client: 'STUDIO ACNE', date: '2026.04.12', season: 'FALL / WINTER 26', projectCode: 'IRN-SPEC-09', leadDesigner: 'M. BORSCHE' };
                  } else if (data.type === 'moodTag') {
                    w = 18; h = 5; content = '';
                    blockData = { tags: ['#Brutalism', '#FW26', '#Editorial', '#RawMaterials', '#Swiss'], style: 'filled' };
                  } else if (data.type === 'divider') {
                    w = 24; h = 1; content = '';
                    blockData = { style: 'solid', opacity: 60, color: '#111110' };
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
                    const selected = selectedIds.includes(b.id);
                    const isPrimary = selectedId === b.id;
                    const editing = editingId === b.id;
                    const isZen = viewMode === 'zen';

                    return (
                      <div
                        key={b.id}
                        id={`block-${b.id}`}
                        data-block="true"
                        style={blockStyle(b, rows)}
                        onPointerDown={(e) => onBlockPointerDown(e, b)}
                        onDoubleClick={() => {
                          if (b.type === 'title' || b.type === 'subtitle' || b.type === 'text' || b.type === 'caption') {
                            setEditingId(b.id);
                            setSelectedId(b.id);
                          } else if (b.type === 'image' || b.type === 'card') {
                            setCroppingBlockId(b.id);
                            setSelectedId(b.id);
                          }
                        }}
                        className={`${selected ? 'z-20' : 'z-10'} ${editing
                          ? 'cursor-text'
                          : 'cursor-grab active:cursor-grabbing'
                          }`}
                      >
                        <div className="relative w-full h-full">
                          {/* Swap Target Drop Ring (Kinetic physics highlight) */}
                          {swapTargetId === b.id && (
                            <div className="absolute inset-0 ring-2 ring-accent ring-offset-2 ring-offset-white animate-pulse z-35 pointer-events-none rounded-sm" />
                          )}

                          {/* Active Bounding Box (Refined hairline outline) */}
                          {selected && (
                            <div
                              className={`absolute inset-0 border border-[#0D99FF]/70 pointer-events-none z-20 transition-colors`}
                            />
                          )}

                          {/* Crop / Focal Point Overlay */}
                          {croppingBlockId === b.id && (
                            <CropOverlay
                              block={b}
                              imageUrl={objectUrlFor(b.content, images.find(img => img.id === b.content)?.blob || new Blob())}
                              onSave={(crop) => {
                                if (activePage) {
                                  const updated = { ...b, data: { ...b.data, crop } };
                                  updateBlock(activePage.id, updated);
                                  pushHistory(pages.map(p => p.id === activePage.id ? { ...p, blocks: p.blocks.map(item => item.id === b.id ? updated : item) } : p), project?.styles);
                                }
                              }}
                              onClose={() => setCroppingBlockId(null)}
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

                  {/* Pinned Canvas-Level Hover Action Pill: Renders OUTSIDE any block stacking context with z-[1000] */}
                  {(() => {
                    const primaryBlock = activePage.blocks.find((b) => b.id === selectedId);
                    if (!primaryBlock || isInteracting) return null;
                    return (
                      <div
                        data-action-pill="true"
                        style={{
                          position: 'absolute',
                          left: `${(primaryBlock.x / COLS) * 100}%`,
                          top: `${(primaryBlock.y / rows) * 100}%`,
                          width: `${(primaryBlock.w / COLS) * 100}%`,
                          height: `${(primaryBlock.h / rows) * 100}%`,
                          pointerEvents: 'none',
                          zIndex: 1000,
                        }}
                      >
                        <div
                          className={`absolute ${
                            primaryBlock.y <= 1 ? 'top-2.5' : '-top-10'
                          } ${
                            primaryBlock.x < 4 
                              ? 'left-2 translate-x-0' 
                              : (primaryBlock.x + primaryBlock.w > COLS - 4 
                                  ? 'right-2 left-auto translate-x-0' 
                                  : 'left-1/2 -translate-x-1/2')
                          } bg-white text-ink shadow-[0_8px_30px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)] rounded-full px-2 py-1 flex items-center gap-1 select-none pointer-events-auto transition-all duration-150 whitespace-nowrap`}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateSelected();
                            }}
                            title="Duplicate Block (Ctrl+D)"
                            className="p-1 hover:bg-surface-muted hover:text-ink text-text-muted rounded-full transition-colors flex items-center justify-center"
                          >
                            <Copy size={13} strokeWidth={2} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              bringForward();
                            }}
                            title="Bring to Front"
                            className="p-1 hover:bg-surface-muted hover:text-ink text-text-muted rounded-full transition-colors flex items-center justify-center"
                          >
                            <ArrowUp size={13} strokeWidth={2} />
                          </button>
                          {(primaryBlock.type === 'image' || primaryBlock.type === 'card') && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCroppingBlockId(primaryBlock.id);
                                }}
                                title="Crop & Focal Point"
                                className="p-1 hover:bg-surface-muted hover:text-ink text-text-muted rounded-full transition-colors flex items-center justify-center"
                              >
                                <Crop size={13} strokeWidth={2} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPickerBlockId(primaryBlock.id);
                                }}
                                title="Replace Image"
                                className="p-1 hover:bg-surface-muted hover:text-ink text-text-muted rounded-full transition-colors flex items-center justify-center"
                              >
                                <Upload size={13} strokeWidth={2} />
                              </button>
                            </>
                          )}
                          <div className="w-px h-3.5 bg-surface-muted mx-0.5" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activePage) {
                                persistPage({ ...activePage, blocks: activePage.blocks.filter(item => item.id !== primaryBlock.id) });
                                setSelectedId(null);
                              }
                            }}
                            title="Delete Block (Del)"
                            className="p-1 hover:bg-red-50 hover:text-danger text-text-muted/80 rounded-full transition-colors flex items-center justify-center"
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
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
          <div className="relative">
            <button
              onClick={() => {
                setExportOpen(prev => !prev);
                if (!exportFileName && project?.name) {
                  setExportFileName(project.name);
                }
              }}
              className={`btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                exportOpen ? 'ring-2 ring-accent ring-offset-1' : ''
              }`}
              title="Download PDF"
            >
              <Download size={13} strokeWidth={2.5} />
              <span>Export</span>
            </button>

            {/* Canva-Style Floating Download Popup with Click-off Backdrop */}
            {exportOpen && (
              <>
                <div
                  className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[1px] cursor-default animate-in fade-in duration-150"
                  onClick={() => setExportOpen(false)}
                />
                {exportDropdownJsx}
              </>
            )}
          </div>
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

      {/* Mac Keynote-Grade Fullscreen Presentation Engine */}
      {viewMode === 'zen' && (
        <div
          className={`fixed inset-0 z-[99999] bg-[#0A0A0B] select-none flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
            zenHudVisible ? 'cursor-default' : 'cursor-none'
          }`}
          onPointerMove={handleZenPointerMove}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[data-zen-control="true"]')) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX < rect.width * 0.3) {
              navigateZen('prev');
            } else {
              navigateZen('next');
            }
          }}
        >
          {/* Subtle Ambient Vignette / Depth */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.03)_0%,transparent_70%)]" />

          {/* Top Floating Header HUD */}
          <div
            data-zen-control="true"
            className={`absolute top-5 left-0 right-0 px-8 flex items-center justify-between z-50 pointer-events-auto transition-all duration-300 ${
              zenHudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
            }`}
          >
            {/* Left: Project title & Slide Counter Badge */}
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#18181A]/85 backdrop-blur-xl text-white/90 shadow-lg text-xs font-medium tracking-tight">
              <span className="font-semibold text-white truncate max-w-[220px]">{project?.name || 'Presentation'}</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="text-white/60 font-mono text-[11px]">
                Slide {pages.findIndex((p) => p.id === activePageId) + 1} of {pages.length}
              </span>
            </div>

            {/* Right: Mac Keynote-Style Frosted Glass Exit Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                exitPresentation();
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18181A]/85 hover:bg-[#242428] active:bg-[#2C2C32] text-white/90 hover:text-white backdrop-blur-xl shadow-lg transition-all text-xs font-medium group cursor-pointer"
              title="Exit Presentation (Esc)"
            >
              <X size={14} strokeWidth={2.2} className="group-hover:scale-110 transition-transform text-white/70 group-hover:text-white" />
              <span>Exit</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white/15 rounded text-white/70 font-mono">esc</kbd>
            </button>
          </div>

          {/* Toast Notification: "Start of presentation" / "End of presentation" (Apple HUD Pill) */}
          {zenMessage && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#18181A]/95 backdrop-blur-2xl text-white shadow-[0_12px_36px_rgba(0,0,0,0.6)] text-xs font-semibold tracking-tight">
                {zenMessage.includes('Start') ? (
                  <ArrowLeft size={13} strokeWidth={2.5} className="text-white/60" />
                ) : (
                  <ArrowRight size={13} strokeWidth={2.5} className="text-white/60" />
                )}
                <span>{zenMessage}</span>
              </div>
            </div>
          )}

          {/* Central Slide Canvas (Apple Keynote elevation & proportional fit) */}
          <div
            key={activePageId}
            className="w-[92vw] h-[86vh] bg-white flex items-center justify-center rounded-[3px] shadow-[0_25px_80px_-15px_rgba(0,0,0,0.7)] overflow-hidden transition-opacity duration-200 animate-in fade-in duration-200"
            style={{ aspectRatio: project?.orientation === 'landscape' ? '48/32' : '48/64' }}
          >
            {activePage && (
              <GridSurface
                orientation={project?.orientation ?? 'landscape'}
                styles={project?.styles}
                className="w-full h-full"
                showGridOverlay={false}
              >
                {activePage.blocks.map((b) => (
                  <div key={b.id} style={blockStyle(b, rows)} className="pointer-events-none">
                    <EditorBlockContent block={b} />
                  </div>
                ))}
              </GridSurface>
            )}
          </div>

          {/* Bottom Floating Mac Dock Controller */}
          <div
            data-zen-control="true"
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto transition-all duration-300 ${
              zenHudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-1 bg-[#161618]/90 backdrop-blur-2xl text-white shadow-[0_12px_40px_rgba(0,0,0,0.65)] rounded-full px-2.5 py-1.5">
              {/* Prev Slide */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateZen('prev');
                }}
                disabled={pages.findIndex((p) => p.id === activePageId) === 0}
                title="Previous Slide (←)"
                className="p-1.5 hover:bg-white/15 active:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent rounded-full text-white/80 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} strokeWidth={2.2} />
              </button>

              {/* Slide Counter Badge */}
              <div className="px-3 py-1 text-xs font-mono font-semibold text-white/90 select-none tracking-tight">
                {pages.findIndex((p) => p.id === activePageId) + 1}
                <span className="text-white/40 mx-1">/</span>
                <span className="text-white/60">{pages.length}</span>
              </div>

              {/* Next Slide */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateZen('next');
                }}
                disabled={pages.findIndex((p) => p.id === activePageId) === pages.length - 1}
                title="Next Slide (→ or Space)"
                className="p-1.5 hover:bg-white/15 active:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent rounded-full text-white/80 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>

              <div className="w-px h-3.5 bg-white/15 mx-1" />

              {/* Native Fullscreen Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  } else {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                }}
                title={document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                className="p-1.5 hover:bg-white/15 active:bg-white/20 rounded-full text-white/70 hover:text-white transition-all cursor-pointer"
              >
                {document.fullscreenElement ? <Minimize2 size={14} strokeWidth={2} /> : <Maximize2 size={14} strokeWidth={2} />}
              </button>

              {/* Exit Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  exitPresentation();
                }}
                title="Exit Presentation (Esc)"
                className="p-1.5 hover:bg-red-500/20 active:bg-red-500/30 text-white/70 hover:text-red-400 rounded-full transition-all cursor-pointer ml-0.5"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorBlockContent({ block, onSwatchClick }: { block: Block, onSwatchClick?: (index: number, e: React.MouseEvent) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if ((block.type === 'image' || block.type === 'card') && block.content) {
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
