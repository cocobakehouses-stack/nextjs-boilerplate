'use client';
import { X } from 'lucide-react';

export default function Modal({
  open, title, children, onClose, footer,
}: {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">{title}</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">{children}</div>
          {footer ? <div className="p-4 border-t bg-[var(--surface-muted)]">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
