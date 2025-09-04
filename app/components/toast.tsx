'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info' };
const ToastCtx = createContext<{ push: (t: Omit<Toast,'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast,'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setItems(prev => [...prev, { id, ...t }]);
    setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 2800);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed z-[70] bottom-4 right-4 space-y-2">
        {items.map(t => (
          <div key={t.id}
            className={`px-4 py-2 rounded-lg shadow border bg-white text-sm
              ${t.type==='success' ? 'border-green-300' : t.type==='error' ? 'border-red-300' : 'border-gray-200'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
