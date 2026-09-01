import { useState, useEffect, useRef } from 'react';
import { Pipette, Trash2, Plus, X } from 'lucide-react';
import type { PaletteData, Block } from '../lib/types';

interface PalettePopoverProps {
  block: Block;
  initialIndex: number;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onChange: (newBlock: Block) => void;
}

export default function PalettePopover({ block, initialIndex, anchorRect, onClose, onChange }: PalettePopoverProps) {
  const data = block.data as PaletteData;
  const colors = data.colors;
  
  const [activeIdx, setActiveIdx] = useState(initialIndex);
  const [hexInput, setHexInput] = useState(colors[initialIndex] || '#000000');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(colors[activeIdx] || '#000000');
  }, [activeIdx, colors]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  if (!anchorRect) return null;

  const updateColor = (idx: number, newHex: string) => {
    const newColors = [...colors];
    newColors[idx] = newHex;
    onChange({ ...block, data: { ...data, colors: newColors } });
    setHexInput(newHex);
  };

  const removeColor = (idx: number) => {
    const newColors = colors.filter((_, i) => i !== idx);
    onChange({ ...block, data: { ...data, colors: newColors } });
    if (idx === activeIdx) {
      setActiveIdx(Math.max(0, idx - 1));
    } else if (idx < activeIdx) {
      setActiveIdx(activeIdx - 1);
    }
    if (newColors.length === 0) onClose();
  };

  const addColor = () => {
    if (colors.length >= 8) return;
    const newColors = [...colors, '#E5E5E3'];
    onChange({ ...block, data: { ...data, colors: newColors } });
    setActiveIdx(newColors.length - 1);
  };

  const pickColor = async () => {
    if (!(window as any).EyeDropper) {
      alert('Your browser does not support the EyeDropper API.');
      return;
    }
    try {
      const ed = new (window as any).EyeDropper();
      const result = await ed.open();
      updateColor(activeIdx, result.sRGBHex.toUpperCase());
    } catch (e) {
      // User canceled
    }
  };

  const top = anchorRect.bottom + 8;
  let left = anchorRect.left;
  if (left + 256 > window.innerWidth) left = window.innerWidth - 272; // prevent overflow

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 card p-4 shadow-pop w-64 bg-surface border-[1.5px] border-surface-muted"
      style={{ top, left }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold tracking-wider uppercase text-text-muted">Edit Swatch</h4>
        <button onClick={onClose} className="p-1 text-text-faint hover:text-ink transition rounded">
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {colors.map((c, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`w-6 h-6 rounded-full shrink-0 shadow-sm transition-all border-[1.5px] ${
              i === activeIdx ? 'ring-[1.5px] ring-accent ring-offset-2' : 'border-white/20'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {colors.length < 8 && (
          <button
            onClick={addColor}
            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-[1.5px] border-dashed border-text-faint text-text-muted hover:text-ink hover:border-text-muted transition"
            title="Add Swatch"
          >
            <Plus size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {colors.length > 0 && (
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={hexInput}
            onChange={(e) => updateColor(activeIdx, e.target.value.toUpperCase())}
            className="w-8 h-8 rounded shrink-0 cursor-pointer p-0 border-0 bg-transparent"
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={() => updateColor(activeIdx, hexInput)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateColor(activeIdx, hexInput);
            }}
            className="input font-mono text-sm !py-1.5 uppercase w-full"
          />
          
          <button
            onClick={pickColor}
            className="btn-ghost !px-2 !py-1.5"
            title="Pick color from page"
          >
            <Pipette size={16} strokeWidth={1.5} />
          </button>

          <button
            onClick={() => removeColor(activeIdx)}
            className="btn-ghost !px-2 !py-1.5 text-danger hover:bg-danger/10"
            title="Delete Swatch"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
