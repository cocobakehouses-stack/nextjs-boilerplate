'use client';

import { useEffect, useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import HeaderMenu from '../components/HeaderMenu';

type Product = { id: number; name: string; price: number; active?: boolean };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<number>>(new Set()); // ids กำลังอัพเดต

  function setPendingOn(id: number, on: boolean) {
    setPending(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setProducts(data?.products || []);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(p: Product) {
    const current = p.active ?? true;
    const next = !current;
    setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: next } : x)));
    setPendingOn(p.id, true);

    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error('Toggle failed');
    } catch {
      setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: current } : x)));
      alert('Toggle failed');
    } finally {
      setPendingOn(p.id, false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] p-6">
      <HeaderMenu />

      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Package className="w-6 h-6 text-[var(--brand)]" />
          Manage Products
        </h1>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลดสินค้า…
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-center">Active</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isActive = p.active ?? true;
                  const isPending = pending.has(p.id);
                  return (
                    <tr key={p.id} className="border-t hover:bg-gray-50 transition">
                      <td className="px-3 py-2">{p.id}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-right">{p.price}</td>
                      <td className="px-3 py-2 text-center">
                        <label
                          className={`inline-flex items-center ${isPending ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!isActive}
                            onChange={() => toggleActive(p)}
                            disabled={isPending}
                          />
                          <div className="
                            relative w-11 h-6 rounded-full bg-gray-200 transition
                            peer-focus:ring-2 peer-focus:ring-[var(--brand)]
                            peer-checked:bg-green-600
                            after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                            after:w-5 after:h-5 after:rounded-full after:bg-white after:border after:transition-all
                            peer-checked:after:translate-x-5
                          " />
                          <span className="ml-2 text-xs text-gray-600">
                            {isActive ? 'Active' : 'Inactive'}
                            {isPending ? '…' : ''}
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
