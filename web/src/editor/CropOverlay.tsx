import React, { useState, useRef } from 'react';
import { ZoomIn, RotateCcw, Check, X, Move } from 'lucide-react';
import type { Block } from '../lib/types';

interface CropOverlayProps {
  block: Block;
  imageUrl: string;
  onSave: (crop: { x: number; y: number; zoom: number }) => void;
  onClose: () => void;
}

export default function CropOverlay({
  block,
  imageUrl,
  onSave,
  onClose,
}: CropOverlayProps) {
  const initialCrop = block.data?.crop ?? { x: 50, y: 50, zoom: 1 };
  const [focalX, setFocalX] = useState<number>(initialCrop.x);
  const [focalY, setFocalY] = useState<number>(initialCrop.y);
  const [zoom, setZoom] = useState<number>(initialCrop.zoom ?? 1);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateFocalPoint(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    updateFocalPoint(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const updateFocalPoint = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.round(Math.max(0, Math.min(100, rawX)));
    const clampedY = Math.round(Math.max(0, Math.min(100, rawY)));
    setFocalX(clampedX);
    setFocalY(clampedY);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFocalX(50);
    setFocalY(50);
    setZoom(1);
  };

  const handleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave({ x: focalX, y: focalY, zoom });
    onClose();
  };

  return (
    <div 
      className="absolute inset-0 z-50 rounded-sm overflow-hidden flex flex-col justify-between select-none ring-2 ring-accent"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Pan / Framing Surface */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full h-full cursor-crosshair overflow-hidden bg-black/40"
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover pointer-events-none transition-transform duration-75"
          style={{
            objectPosition: `${focalX}% ${focalY}%`,
            transform: `scale(${zoom})`,
          }}
        />

        {/* Dynamic Focal Point Crosshair Indicator */}
        <div
          className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
          style={{
            left: `${focalX}%`,
            top: `${focalY}%`,
          }}
        >
          <div className="w-6 h-6 rounded-full border border-white shadow-[0_0_8px_rgba(0,0,0,0.8)] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          </div>
          {/* Hairlines */}
          <div className="absolute w-10 h-px bg-white/70 shadow-sm" />
          <div className="absolute h-10 w-px bg-white/70 shadow-sm" />
        </div>

        {/* Framing Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
          <div className="border-r border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div className="border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div className="border-r border-b border-white/20" />
          <div className="border-b border-white/20" />
          <div className="border-r border-white/20" />
          <div className="border-r border-white/20" />
          <div />
        </div>

        {/* Top Hint Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/75 text-white text-[10px] font-mono rounded backdrop-blur-xs flex items-center gap-1.5 pointer-events-none">
          <Move size={11} className="text-accent" />
          <span>DRAG CROSSHAIR TO RECENTER ({focalX}%, {focalY}%)</span>
        </div>
      </div>

      {/* Floating Bottom Control Dock */}
      <div 
        className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-surface-muted flex items-center gap-3 z-50 text-ink"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Zoom Slider */}
        <div className="flex items-center gap-1.5">
          <ZoomIn size={13} className="text-text-muted" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-20 h-1.5 bg-surface-muted rounded-lg appearance-none cursor-pointer accent-ink"
          />
          <span className="text-[10px] font-mono w-7 text-text-muted">{zoom.toFixed(1)}x</span>
        </div>

        <div className="w-px h-3.5 bg-surface-muted" />

        {/* Reset Button */}
        <button
          onClick={handleReset}
          title="Reset Framing"
          className="p-1 hover:bg-surface-muted text-text-muted hover:text-ink rounded-full transition-colors flex items-center justify-center"
        >
          <RotateCcw size={13} strokeWidth={2} />
        </button>

        {/* Done Button */}
        <button
          onClick={handleDone}
          title="Apply Framing"
          className="p-1 bg-accent text-white hover:bg-accent/90 rounded-full transition-colors flex items-center justify-center shadow-xs"
        >
          <Check size={13} strokeWidth={2.5} />
        </button>

        {/* Cancel Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="Cancel"
          className="p-1 hover:bg-surface-muted text-text-muted hover:text-ink rounded-full transition-colors flex items-center justify-center"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
