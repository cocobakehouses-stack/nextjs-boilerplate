'use client';

import { createContext, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; type: ToastType; message: string; duration?: number };

type ToastCtx = {
  push: (t: { type: ToastType; message: string; duration?: number }) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);

  const push: ToastCtx['push'] = ({ type, message, duration = 2500 }) => {
    const id = Date.now() + Math.random();
    setList((prev) => [...prev, { id, type, message, duration }]);
    // auto-dismiss
    window.setTimeout(() => {
      setList((prev) => prev.filter((x) => x.id !== id));
    }, duration);
  };

  const value = useMemo(() => ({ push }), []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Toaster list={list} onClose={(id) => setList((prev) => prev.filter((x) => x.id !== id))} />
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used within <ToastProvider>');
  return v;
}

function Toaster({ list, onClose }: { list: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[1100] space-y-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={[
            'min-w-[240px] rounded-lg border px-3 py-2 shadow bg-white text-sm',
            t.type === 'success' ? 'border-green-600/30' :
            t.type === 'error'   ? 'border-red-600/30'   : 'border-gray-300'
          ].join(' ')}
          role="status"
        >
          <div className="font-medium mb-0.5">
            {t.type === 'success' ? 'Success' : t.type === 'error' ? 'Error' : 'Info'}
          </div>
          <div className="text-gray-700">{t.message}</div>
          <button
            onClick={() => onClose(t.id)}
            className="mt-2 text-xs underline text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
