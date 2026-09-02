import { useState, useRef, useEffect } from 'react';
import { 
  Sliders, 
  Type, 
  Square, 
  ChevronDown, 
  Check, 
  Undo2, 
  Redo2, 
  Magnet, 
  ArrowDown, 
  Move, 
  Pipette 
} from 'lucide-react';
import type { ProjectStyles } from '../lib/types';

export interface StudioStyleBarProps {
  styles: ProjectStyles;
  onChange: (newStyles: ProjectStyles) => void;
  physicsMode?: 'free' | 'swap' | 'push';
  onPhysicsModeChange?: (mode: 'free' | 'swap' | 'push') => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onEyedropper?: () => void;
}

export default function StudioStyleBar({
  styles,
  onChange,
  physicsMode = 'free',
  onPhysicsModeChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onEyedropper,
}: StudioStyleBarProps) {
  const [activeMenu, setActiveMenu] = useState<'radius' | 'gap' | 'margin' | 'font' | 'tone' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, []);

  const currentRadius = styles.cornerRadius ?? 8;
  const currentGap = styles.gridGap ?? 8;
  const currentMargin = styles.margin ?? 24;
  const currentFont = styles.fontPairing ?? 'sans';
  const currentTone = styles.canvasTone ?? 'studio';

  const toneMap: Record<string, { bg: string; name: string; border: string }> = {
    studio: { bg: '#FAFAF9', name: 'Studio White', border: '#E5E5E3' },
    linen: { bg: '#F6F4EE', name: 'Warm Linen', border: '#E0DDD4' },
    slate: { bg: '#ECEBE8', name: 'Cool Grey', border: '#D8D7D3' },
    obsidian: { bg: '#111110', name: 'Obsidian Black', border: '#333330' },
  };

  return (
    <div ref={containerRef} className="relative z-30 mb-3 w-full">
      <div className="card px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-sm bg-white/90 backdrop-blur-md border border-surface-muted">
        {/* Left: Undo / Redo + Physics Mode */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo History */}
          <div className="flex items-center bg-surface-muted/40 p-0.5 rounded-lg border border-surface-muted/50">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className={`p-1.5 rounded-md transition-colors ${
                canUndo 
                  ? 'text-ink hover:bg-black/5 active:scale-95' 
                  : 'text-text-muted/40 cursor-not-allowed'
              }`}
            >
              <Undo2 size={13} strokeWidth={2} />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className={`p-1.5 rounded-md transition-colors ${
                canRedo 
                  ? 'text-ink hover:bg-black/5 active:scale-95' 
                  : 'text-text-muted/40 cursor-not-allowed'
              }`}
            >
              <Redo2 size={13} strokeWidth={2} />
            </button>
          </div>

          <div className="w-px h-4 bg-surface-muted" />

          {/* Kinetic Physics Toggle */}
          <div className="flex items-center bg-surface-muted/40 p-0.5 rounded-lg border border-surface-muted/50">
            <button
              onClick={() => onPhysicsModeChange?.('free')}
              title="Free Placement (Figma style free moves)"
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                physicsMode === 'free'
                  ? 'bg-white text-ink shadow-xs ring-1 ring-black/5 font-bold'
                  : 'text-text-muted hover:text-ink'
              }`}
            >
              <Move size={11} strokeWidth={2} />
              <span>Free</span>
            </button>
            <button
              onClick={() => onPhysicsModeChange?.('swap')}
              title="Drag-to-Swap (Magnetic grid exchange)"
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                physicsMode === 'swap'
                  ? 'bg-white text-accent shadow-xs ring-1 ring-black/5 font-bold'
                  : 'text-text-muted hover:text-ink'
              }`}
            >
              <Magnet size={11} strokeWidth={2} />
              <span>Swap</span>
            </button>
            <button
              onClick={() => onPhysicsModeChange?.('push')}
              title="Collision Push (Downward auto-shove)"
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                physicsMode === 'push'
                  ? 'bg-white text-ink shadow-xs ring-1 ring-black/5 font-bold'
                  : 'text-text-muted hover:text-ink'
              }`}
            >
              <ArrowDown size={11} strokeWidth={2} />
              <span>Push</span>
            </button>
          </div>

          {onEyedropper && (
            <>
              <div className="w-px h-4 bg-surface-muted" />
              <button
                onClick={onEyedropper}
                title="Live Color Eyedropper"
                className="p-1.5 text-text-muted hover:text-ink hover:bg-surface-muted/50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <Pipette size={13} strokeWidth={2} />
                <span className="hidden sm:inline text-[11px]">Sample</span>
              </button>
            </>
          )}
        </div>

        {/* Right: Studio Aesthetic Controls */}
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {/* Corner Radius Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'radius' ? null : 'radius')}
              className={`btn-ghost !px-2.5 !py-1 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'radius' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Global Corner Radius"
            >
              <div className="flex items-center justify-center w-3.5 h-3.5 shrink-0">
                <Square size={13} strokeWidth={1.5} />
              </div>
              <span className="text-[11px]">Radius: {currentRadius}px</span>
              <ChevronDown size={11} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'radius' && (
              <div className="absolute top-full right-0 mt-1.5 w-48 card p-3 shadow-pop z-50 bg-white">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Corner Curvature</p>
                <div className="flex flex-col gap-1">
                  {[
                    { val: 0, label: '0px (Sharp Brutalist)' },
                    { val: 4, label: '4px (Minimal)' },
                    { val: 8, label: '8px (Modern Studio)' },
                    { val: 16, label: '16px (Soft Curve)' },
                    { val: 24, label: '24px (Playful Pill)' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() => {
                        onChange({ ...styles, cornerRadius: preset.val });
                        setActiveMenu(null);
                      }}
                      className="btn-ghost !py-1.5 !px-2 text-xs justify-between w-full text-left"
                    >
                      <span className={currentRadius === preset.val ? 'font-bold text-accent' : ''}>{preset.label}</span>
                      {currentRadius === preset.val && <Check size={13} strokeWidth={1.5} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grid Gap Controller */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'gap' ? null : 'gap')}
              className={`btn-ghost !px-2.5 !py-1 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'gap' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Global Grid Gap"
            >
              <div className="flex items-center justify-center w-3.5 h-3.5 shrink-0">
                <Sliders size={13} strokeWidth={1.5} />
              </div>
              <span className="text-[11px]">Gap: {currentGap}px</span>
              <ChevronDown size={11} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'gap' && (
              <div className="absolute top-full right-0 mt-1.5 w-44 card p-3 shadow-pop z-50 bg-white">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Grid Spacing</p>
                <div className="flex flex-col gap-1">
                  {[
                    { val: 0, label: '0px (Seamless)' },
                    { val: 8, label: '8px (Tight Studio)' },
                    { val: 16, label: '16px (Balanced)' },
                    { val: 24, label: '24px (Editorial Airy)' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() => {
                        onChange({ ...styles, gridGap: preset.val });
                        setActiveMenu(null);
                      }}
                      className="btn-ghost !py-1.5 !px-2 text-xs justify-between w-full text-left"
                    >
                      <span className={currentGap === preset.val ? 'font-bold text-accent' : ''}>{preset.label}</span>
                      {currentGap === preset.val && <Check size={13} strokeWidth={1.5} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Typography Pairing */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'font' ? null : 'font')}
              className={`btn-ghost !px-2.5 !py-1 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'font' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Global Typography Pairing"
            >
              <div className="flex items-center justify-center w-3.5 h-3.5 shrink-0">
                <Type size={13} strokeWidth={1.5} />
              </div>
              <span className="capitalize text-[11px]">Type: {currentFont}</span>
              <ChevronDown size={11} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'font' && (
              <div className="absolute top-full right-0 mt-1.5 w-56 card p-3 shadow-pop z-50 bg-white">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Font Pairing</p>
                <div className="flex flex-col gap-1">
                  {[
                    { id: 'sans', name: 'Swiss Sans', font: 'Manrope, sans-serif' },
                    { id: 'serif', name: 'Editorial Serif', font: 'Newsreader, Playfair Display, serif' },
                    { id: 'mono', name: 'Studio Mono', font: 'JetBrains Mono, monospace' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onChange({ ...styles, fontPairing: f.id as any });
                        setActiveMenu(null);
                      }}
                      className="btn-ghost !py-2 !px-2 text-xs justify-between w-full text-left"
                    >
                      <div>
                        <p className={currentFont === f.id ? 'font-bold text-accent' : 'font-medium'}>{f.name}</p>
                        <p className="text-[11px] text-text-muted" style={{ fontFamily: f.font }}>The quick brown fox</p>
                      </div>
                      {currentFont === f.id && <Check size={13} strokeWidth={1.5} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Canvas Tone / Atmosphere */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'tone' ? null : 'tone')}
              className={`btn-ghost !px-2.5 !py-1 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'tone' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Canvas Atmosphere Tone"
            >
              <div
                className="w-3 h-3 rounded-full border-[1.5px] shrink-0"
                style={{ backgroundColor: toneMap[currentTone]?.bg, borderColor: toneMap[currentTone]?.border }}
              />
              <span className="capitalize text-[11px]">{currentTone}</span>
              <ChevronDown size={11} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'tone' && (
              <div className="absolute top-full right-0 mt-1.5 w-52 card p-3 shadow-pop z-50 bg-white">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Canvas Atmosphere</p>
                <div className="flex flex-col gap-1.5">
                  {(Object.keys(toneMap) as Array<keyof typeof toneMap>).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        onChange({ ...styles, canvasTone: t as any });
                        setActiveMenu(null);
                      }}
                      className="btn-ghost !py-1.5 !px-2 text-xs justify-between w-full text-left flex items-center"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border-[1.5px] shrink-0 shadow-xs"
                          style={{ backgroundColor: toneMap[t].bg, borderColor: toneMap[t].border }}
                        />
                        <span className={currentTone === t ? 'font-bold text-accent' : ''}>{toneMap[t].name}</span>
                      </div>
                      {currentTone === t && <Check size={13} strokeWidth={1.5} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
