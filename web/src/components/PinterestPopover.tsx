import { useState, useEffect, useRef } from 'react';
import { PinterestIcon, Keycap } from './Keycap';
import { importPinterestBoard, pinterestImageProxyUrl } from '../lib/api';
import { normalizeImage } from '../lib/images';
import { putImage } from '../db/repo';
import { Loader2, ArrowRight, X, AlertCircle } from 'lucide-react';

interface PinterestPopoverProps {
  projectId: string;
  existingImages: { originalUrl?: string | null }[];
  onImported: () => void;
  triggerClassName?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

function normalizeUrl(input: string): string {
  let trimmed = input.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  return trimmed;
}

function isValidBoardUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url);
    const u = new URL(normalized);
    const isPinIt = /(^|\.)pin\.it$/i.test(u.hostname);
    const isPinterest = /(^|\.)pinterest\./i.test(u.hostname);
    if (isPinIt && u.pathname.replace(/\/+$/, '').length > 1) return true;
    if (isPinterest && u.pathname.split('/').filter(Boolean).length >= 1) return true;
    return false;
  } catch {
    return false;
  }
}

export default function PinterestPopover({
  projectId,
  existingImages,
  onImported,
  triggerClassName = 'btn-secondary',
  align = 'right',
  className = '',
}: PinterestPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // When popover opens: auto-focus & auto-detect Pinterest URL from clipboard!
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    // Auto-focus input
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    // Auto-detect clipboard URL
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText()
        .then((text) => {
          const trimmed = text.trim();
          if (isValidBoardUrl(trimmed)) {
            setUrl(trimmed);
          }
        })
        .catch(() => {
          /* Clipboard permission optional */
        });
    }

    return () => clearTimeout(timer);
  }, [isOpen]);

  async function handleImport() {
    const normalized = normalizeUrl(url);
    if (!isValidBoardUrl(normalized)) {
      setError('Please paste a valid board URL (e.g. pinterest.com/user/board or pin.it/...)');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusText('Fetching board…');

    try {
      const { pins } = await importPinterestBoard(normalized);
      if (!pins || pins.length === 0) {
        throw new Error('This board has no accessible pins.');
      }

      let added = 0;
      for (const [i, pin] of pins.entries()) {
        setStatusText(`Saving ${i + 1} of ${pins.length}…`);
        if (existingImages.some((img) => img.originalUrl === pin.imageUrl)) {
          continue;
        }
        try {
          const res = await fetch(pinterestImageProxyUrl(pin.imageUrl));
          if (!res.ok) continue;
          const blob = await normalizeImage(await res.blob());
          await putImage({
            projectId,
            styleGroupId: null,
            blob,
            source: 'pinterest',
            originalUrl: pin.imageUrl,
          });
          added += 1;
        } catch {
          // ignore single image failures
        }
      }

      setUrl('');
      setIsOpen(false);
      onImported();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setError(msg.includes('configured') ? 'Pinterest access token missing on server.' : msg);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  }

  const alignmentClass =
    align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : align === 'left'
      ? 'left-0'
      : 'right-0';

  return (
    <div ref={containerRef} className={`relative ${className || 'inline-block text-left'}`}>
      {/* Trigger Button with Active State */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`${triggerClassName} flex items-center gap-2 ${
          isOpen ? 'bg-surface-active text-ink' : ''
        } ${loading ? 'animate-pulse cursor-wait' : ''}`}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin text-accent" />
        ) : (
          <PinterestIcon size={16} className="text-[#E60023]" />
        )}
        <span>{loading ? statusText || 'Importing…' : 'Import Pinterest'}</span>
        {!loading && <span className="text-[10px] opacity-60">▾</span>}
      </button>

      {/* Floating Raycast / Craft Style Popover */}
      {isOpen && (
        <div className={`absolute ${alignmentClass} mt-2 w-80 sm:w-96 max-w-[calc(100vw-32px)] rounded-2xl bg-white shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150`}>
          <div className="flex items-center justify-between pb-2 mb-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <PinterestIcon size={14} className="text-[#E60023]" />
              <span>Import Pinterest Board</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted/70 hover:text-ink p-1 rounded-md transition-colors"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleImport();
            }}
            className="space-y-3"
          >
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleImport();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                  }
                }}
                placeholder="pinterest.com/username/board/ or pin.it/..."
                disabled={loading}
                className="w-full bg-[#F5F5F3] focus:bg-white text-ink text-xs rounded-xl px-3.5 py-2.5 pr-10 outline-none transition-all placeholder:text-text-muted/60"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="absolute right-1.5 p-1.5 rounded-lg bg-ink text-white hover:bg-ink/90 disabled:opacity-30 disabled:hover:bg-ink transition-all flex items-center justify-center shadow-xs"
                title="Press Enter to import"
              >
                {loading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArrowRight size={13} strokeWidth={2.2} />
                )}
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs leading-snug">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-text-muted/80 pt-1 px-0.5">
              <span>Paste board URL</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px]">
                <Keycap label="↵" className="min-w-[20px] h-5 text-[10px]" />
                <span>to import</span>
                <span className="opacity-40">•</span>
                <Keycap label="esc" className="min-w-[24px] h-5 text-[9px]" />
              </span>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
