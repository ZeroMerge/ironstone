import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card shadow-pop w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <div className="flex items-center justify-center w-5 h-5 shrink-0">
              <X size={16} strokeWidth={1.5} />
            </div>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
