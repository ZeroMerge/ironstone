import { useEffect, useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  X,
} from 'lucide-react';
import type { BlockType } from '../lib/types';

interface TextSelectionToolbarProps {
  position: { top: number; left: number };
  activeHierarchy: BlockType;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  letterSpacing?: string;
  onHierarchyChange: (type: BlockType) => void;
  onAlignChange: (align: 'left' | 'center' | 'right' | 'justify') => void;
  onTrackingChange: (tracking: string) => void;
  onFormatCommand: (command: string, value?: string) => void;
  onClose?: () => void;
}

const HIERARCHY_OPTIONS: { type: BlockType; label: string; shortcut: string }[] = [
  { type: 'title', label: 'Title', shortcut: '⌥⌘1' },
  { type: 'subtitle', label: 'Subtitle', shortcut: '⌥⌘2' },
  { type: 'text', label: 'Body', shortcut: '⌥⌘3' },
  { type: 'caption', label: 'Caption', shortcut: '⌥⌘4' },
];

const TRACKING_OPTIONS = [
  { label: 'Tight', value: '-0.03em' },
  { label: 'Normal', value: '0em' },
  { label: 'Wide', value: '0.08em' },
  { label: 'Luxury', value: '0.15em' },
];

export default function TextSelectionToolbar({
  position,
  activeHierarchy,
  textAlign = 'left',
  letterSpacing = '0em',
  onHierarchyChange,
  onAlignChange,
  onTrackingChange,
  onFormatCommand,
  onClose,
}: TextSelectionToolbarProps) {
  const [showHierarchyMenu, setShowHierarchyMenu] = useState(false);
  const [showTrackingMenu, setShowTrackingMenu] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowHierarchyMenu(false);
        setShowTrackingMenu(false);
      }
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const activeHierarchyLabel = HIERARCHY_OPTIONS.find((h) => h.type === activeHierarchy)?.label ?? 'Body';
  const activeTrackingLabel = TRACKING_OPTIONS.find((t) => t.value === letterSpacing)?.label ?? 'Tracking';

  return (
    <div
      ref={toolbarRef}
      data-text-toolbar="true"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%) translateY(-10px)',
      }}
      className="fixed z-50 flex items-center gap-0.5 bg-white/95 backdrop-blur-md ring-1 ring-black/10 shadow-[0_12px_36px_rgba(0,0,0,0.14)] rounded-xl px-1.5 py-1 select-none animate-in fade-in zoom-in-95 duration-150 ease-out"
    >
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowHierarchyMenu((prev) => !prev);
            setShowTrackingMenu(false);
          }}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-ink hover:bg-black/5 rounded-lg transition-colors"
        >
          <span>{activeHierarchyLabel}</span>
          <ChevronDown size={11} strokeWidth={2.5} className="text-text-muted" />
        </button>

        {showHierarchyMenu && (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute top-full left-0 mt-1.5 w-36 bg-white rounded-xl shadow-xl ring-1 ring-black/10 py-1 z-50 flex flex-col"
          >
            {HIERARCHY_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onHierarchyChange(opt.type);
                  setShowHierarchyMenu(false);
                }}
                className={`flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                  activeHierarchy === opt.type
                    ? 'font-bold text-ink bg-black/5'
                    : 'text-text-muted hover:text-ink hover:bg-black/5'
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-[10px] text-text-faint font-mono">{opt.shortcut}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-black/10 mx-0.5" />

      <button
        type="button"
        title="Bold (⌘B)"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormatCommand('bold');
        }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-ink hover:bg-black/5 transition-colors"
      >
        <Bold size={13} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        title="Italic (⌘I)"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormatCommand('italic');
        }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-ink hover:bg-black/5 transition-colors"
      >
        <Italic size={13} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        title="Underline (⌘U)"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormatCommand('underline');
        }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-ink hover:bg-black/5 transition-colors"
      >
        <Underline size={13} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        title="Strikethrough"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormatCommand('strikeThrough');
        }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-ink hover:bg-black/5 transition-colors"
      >
        <Strikethrough size={13} strokeWidth={2.5} />
      </button>

      <div className="w-[1px] h-4 bg-black/10 mx-0.5" />

      <div className="relative">
        <button
          type="button"
          title="Letter Spacing"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowTrackingMenu((prev) => !prev);
            setShowHierarchyMenu(false);
          }}
          className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-text-muted hover:text-ink hover:bg-black/5 rounded-lg transition-colors"
        >
          <span className="text-[11px] font-mono tracking-wider">AV</span>
          <span className="text-[10px]">{activeTrackingLabel}</span>
          <ChevronDown size={10} strokeWidth={2.5} className="text-text-muted/60" />
        </button>

        {showTrackingMenu && (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute top-full left-0 mt-1.5 w-28 bg-white rounded-xl shadow-xl ring-1 ring-black/10 py-1 z-50 flex flex-col"
          >
            {TRACKING_OPTIONS.map((trk) => (
              <button
                key={trk.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTrackingChange(trk.value);
                  setShowTrackingMenu(false);
                }}
                className={`px-3 py-1.5 text-xs text-left transition-colors ${
                  letterSpacing === trk.value
                    ? 'font-bold text-ink bg-black/5'
                    : 'text-text-muted hover:text-ink hover:bg-black/5'
                }`}
              >
                {trk.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-black/10 mx-0.5" />

      <div className="flex items-center">
        <button
          type="button"
          title="Align Left"
          onMouseDown={(e) => {
            e.preventDefault();
            onAlignChange('left');
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            textAlign === 'left' ? 'text-ink bg-black/5' : 'text-text-muted hover:text-ink hover:bg-black/5'
          }`}
        >
          <AlignLeft size={13} strokeWidth={2} />
        </button>

        <button
          type="button"
          title="Align Center"
          onMouseDown={(e) => {
            e.preventDefault();
            onAlignChange('center');
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            textAlign === 'center' ? 'text-ink bg-black/5' : 'text-text-muted hover:text-ink hover:bg-black/5'
          }`}
        >
          <AlignCenter size={13} strokeWidth={2} />
        </button>

        <button
          type="button"
          title="Align Right"
          onMouseDown={(e) => {
            e.preventDefault();
            onAlignChange('right');
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            textAlign === 'right' ? 'text-ink bg-black/5' : 'text-text-muted hover:text-ink hover:bg-black/5'
          }`}
        >
          <AlignRight size={13} strokeWidth={2} />
        </button>

        <button
          type="button"
          title="Justify"
          onMouseDown={(e) => {
            e.preventDefault();
            onAlignChange('justify');
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            textAlign === 'justify' ? 'text-ink bg-black/5' : 'text-text-muted hover:text-ink hover:bg-black/5'
          }`}
        >
          <AlignJustify size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-black/10 mx-0.5" />

      <button
        type="button"
        title="Dismiss toolbar (Esc)"
        onMouseDown={(e) => {
          e.preventDefault();
          onClose?.();
          window.getSelection()?.removeAllRanges();
        }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-ink hover:bg-black/5 transition-colors"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}
