import { useState, useRef, useEffect } from 'react';
import { Sliders, Type, Square, Maximize2, Palette, ChevronDown, Check } from 'lucide-react';
import type { ProjectStyles } from '../lib/types';

interface StudioStyleBarProps {
  styles: ProjectStyles;
  onChange: (newStyles: ProjectStyles) => void;
}

export default function StudioStyleBar({ styles, onChange }: StudioStyleBarProps) {
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
    <div ref={containerRef} className="relative z-30 mb-5">
      <div className="card px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm bg-surface">
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          <span className="text-[11px] font-bold text-text-muted/80 uppercase tracking-wider px-2 mr-1">
            Studio Controls
          </span>

          {/* Corner Radius Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'radius' ? null : 'radius')}
              className={`btn-ghost !px-2.5 !py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'radius' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Global Corner Radius"
            >
              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                <Square size={14} strokeWidth={1.5} />
              </div>
              <span>Radius: {currentRadius}px</span>
              <ChevronDown size={12} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'radius' && (
              <div className="absolute top-full left-0 mt-1.5 w-48 card p-3 shadow-pop z-50 bg-surface">
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
                      {currentRadius === preset.val && <Check size={14} strokeWidth={1.5} className="text-accent" />}
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
              className={`btn-ghost !px-2.5 !py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'gap' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Global Grid Gap"
            >
              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                <Sliders size={14} strokeWidth={1.5} />
              </div>
              <span>Gap: {currentGap}px</span>
              <ChevronDown size={12} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'gap' && (
              <div className="absolute top-full left-0 mt-1.5 w-44 card p-3 shadow-pop z-50 bg-surface">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Cell Spacing</p>
                <div className="flex flex-col gap-1">
                  {[
                    { val: 8, label: 'Tight (8px)' },
                    { val: 16, label: 'Balanced (16px)' },
                    { val: 24, label: 'Airy (24px)' },
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
                      {currentGap === preset.val && <Check size={14} strokeWidth={1.5} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Document Margin */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'margin' ? null : 'margin')}
              className={`btn-ghost !px-2.5 !py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'margin' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Outer Document Margins"
            >
              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                <Maximize2 size={14} strokeWidth={1.5} />
              </div>
              <span>Margin: {currentMargin}px</span>
              <ChevronDown size={12} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'margin' && (
              <div className="absolute top-full left-0 mt-1.5 w-44 card p-3 shadow-pop z-50 bg-surface">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Print Margin</p>
                <div className="flex flex-col gap-1">
                  {[
                    { val: 16, label: 'Compact (16px)' },
                    { val: 24, label: 'Standard (24px)' },
                    { val: 32, label: 'Generous (32px)' },
                    { val: 48, label: 'Editorial (48px)' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() => {
                        onChange({ ...styles, margin: preset.val });
                        setActiveMenu(null);
                      }}
                      className="btn-ghost !py-1.5 !px-2 text-xs justify-between w-full text-left"
                    >
                      <span className={currentMargin === preset.val ? 'font-bold text-accent' : ''}>{preset.label}</span>
                      {currentMargin === preset.val && <Check size={14} strokeWidth={1.5} className="text-accent" />}
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
              className={`btn-ghost !px-2.5 !py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'font' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Global Typography Pairing"
            >
              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                <Type size={14} strokeWidth={1.5} />
              </div>
              <span className="capitalize">Type: {currentFont}</span>
              <ChevronDown size={12} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'font' && (
              <div className="absolute top-full left-0 mt-1.5 w-56 card p-3 shadow-pop z-50 bg-surface">
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
                      {currentFont === f.id && <Check size={14} strokeWidth={1.5} className="text-accent" />}
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
              className={`btn-ghost !px-2.5 !py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${
                activeMenu === 'tone' ? 'bg-surface-muted text-ink' : ''
              }`}
              title="Canvas Atmosphere Tone"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border-[1.5px] shrink-0"
                style={{ backgroundColor: toneMap[currentTone]?.bg, borderColor: toneMap[currentTone]?.border }}
              />
              <span className="capitalize">{currentTone}</span>
              <ChevronDown size={12} strokeWidth={1.5} className="text-text-muted" />
            </button>

            {activeMenu === 'tone' && (
              <div className="absolute top-full left-0 mt-1.5 w-52 card p-3 shadow-pop z-50 bg-surface">
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
                          className="w-4 h-4 rounded-full border-[1.5px] shrink-0 shadow-sm"
                          style={{ backgroundColor: toneMap[t].bg, borderColor: toneMap[t].border }}
                        />
                        <span className={currentTone === t ? 'font-bold text-accent' : ''}>{toneMap[t].name}</span>
                      </div>
                      {currentTone === t && <Check size={14} strokeWidth={1.5} className="text-accent" />}
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
