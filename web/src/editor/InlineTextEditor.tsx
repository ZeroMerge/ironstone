import { useEffect, useRef, useState, useCallback } from 'react';
import type { Block, BlockType, BlockStyle } from '../lib/types';
import TextSelectionToolbar from './TextSelectionToolbar';

interface InlineTextEditorProps {
  block: Block;
  isEditing: boolean;
  onCommit: (content: string) => void;
  onTypeChange: (newType: BlockType) => void;
  onStyleChange: (stylePatch: Partial<BlockStyle>) => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
}

const PLACEHOLDERS: Record<string, string> = {
  title: 'Untitled Moodboard',
  subtitle: 'Add subtitle or concept direction...',
  text: 'Write notes, aesthetic references, or client direction...',
  caption: 'CAPTION / SPEC',
};

export default function InlineTextEditor({
  block,
  isEditing,
  onCommit,
  onTypeChange,
  onStyleChange,
  onStartEditing,
  onStopEditing,
}: InlineTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!block.content || block.content === '<br>');
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync content into contentEditable only on initial mount or when switching into edit mode
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== (block.content || '')) {
        editorRef.current.innerHTML = block.content || '';
      }
      checkIsEmpty();
    }
  }, [block.id, isEditing]);

  const checkIsEmpty = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText?.trim() ?? '';
    setIsEmpty(text.length === 0);
  }, []);

  // Update selection toolbar position
  const updateSelectionToolbar = useCallback(() => {
    if (!isEditing) {
      setToolbarPosition(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setToolbarPosition(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setToolbarPosition(null);
      return;
    }

    // Ensure selection is inside this editor
    if (
      editorRef.current &&
      (editorRef.current.contains(selection.anchorNode) || editorRef.current.contains(selection.focusNode))
    ) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setToolbarPosition({
          top: rect.top,
          left: rect.left + rect.width / 2,
        });
        return;
      }
    }

    setToolbarPosition(null);
  }, [isEditing]);

  // Listen to document selection changes
  useEffect(() => {
    document.addEventListener('selectionchange', updateSelectionToolbar);
    return () => document.removeEventListener('selectionchange', updateSelectionToolbar);
  }, [updateSelectionToolbar]);

  // Handle Input with debounced persistence
  const handleInput = () => {
    checkIsEmpty();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      if (editorRef.current) {
        onCommit(editorRef.current.innerHTML);
      }
    }, 300);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (editorRef.current) {
      onCommit(editorRef.current.innerHTML);
    }
    setToolbarPosition(null);
  };

  // Keyboard shortcuts (Cmd+B, Cmd+I, Cmd+U, Ctrl+Alt+1..4)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onStopEditing();
      return;
    }

    const isMod = e.metaKey || e.ctrlKey;

    // Rich formatting shortcuts
    if (isMod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      document.execCommand('bold');
      return;
    }
    if (isMod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      document.execCommand('italic');
      return;
    }
    if (isMod && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      document.execCommand('underline');
      return;
    }

    // Hierarchy shortcuts: Ctrl+Alt+1..4 (or Cmd+Option+1..4)
    if (isMod && e.altKey) {
      if (e.key === '1') {
        e.preventDefault();
        onTypeChange('title');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        onTypeChange('subtitle');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        onTypeChange('text');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        onTypeChange('caption');
        return;
      }
    }
  };

  // Exec command wrapper
  const handleFormatCommand = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    handleInput();
  };

  // Typographic styling matching the agreed 4-Tier Hierarchy & Top-Baseline Horizon
  const typographyClass =
    block.type === 'title'
      ? 'font-extrabold tracking-tight leading-[1.08] text-[5cqw] text-[#111110]'
      : block.type === 'subtitle'
      ? 'font-medium leading-[1.28] tracking-normal text-[2.4cqw] text-[#575653]'
      : block.type === 'caption'
      ? 'font-mono uppercase tracking-[0.1em] leading-[1.4] text-[1.2cqw] text-[#8C8983]'
      : 'font-normal leading-[1.55] tracking-normal text-[1.8cqw] text-[#2E2D29] whitespace-pre-wrap';

  const customStyle: React.CSSProperties = {
    textAlign: block.style?.textAlign || 'left',
    letterSpacing: block.style?.letterSpacing,
    fontSize: block.style?.fontSize ? `${block.style.fontSize}px` : undefined,
    fontWeight: block.style?.fontWeight,
    color: block.style?.color,
  };

  const placeholder = PLACEHOLDERS[block.type] || 'Write something...';

  return (
    <div
      className="w-full h-full flex items-start relative overflow-hidden"
      onClick={() => {
        if (!isEditing) onStartEditing();
      }}
    >
      {/* Ghost Placeholder when empty */}
      {isEmpty && (
        <div
          className={`absolute top-0 left-0 pointer-events-none select-none text-text-muted/35 w-full ${typographyClass}`}
          style={customStyle}
        >
          {placeholder}
        </div>
      )}

      {/* Direct contentEditable Editor (Transparent, Zero Boxiness, Zero Padding Jump) */}
      <div
        ref={editorRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseUp={updateSelectionToolbar}
        onKeyUp={updateSelectionToolbar}
        className={`w-full h-full bg-transparent p-0 m-0 outline-none border-none cursor-text ${typographyClass}`}
        style={customStyle}
      />

      {/* Floating Selection Toolbar (Only appears on highlighted text) */}
      {toolbarPosition && (
        <TextSelectionToolbar
          position={toolbarPosition}
          activeHierarchy={block.type}
          textAlign={block.style?.textAlign}
          letterSpacing={block.style?.letterSpacing}
          onHierarchyChange={onTypeChange}
          onAlignChange={(align) => onStyleChange({ textAlign: align })}
          onTrackingChange={(tracking) => onStyleChange({ letterSpacing: tracking })}
          onFormatCommand={handleFormatCommand}
          onClose={() => setToolbarPosition(null)}
        />
      )}
    </div>
  );
}
