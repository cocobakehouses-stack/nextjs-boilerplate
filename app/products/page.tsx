// app/products/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Product = { id: number; name: string; price: number; active?: boolean };

export default function ProductManagerPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Product[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/products?all=1', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Load failed');
      setList(data.products || []);
    } catch (e: any) {
      setError(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(p: Product) {
    try {
      setSavingId(p.id);
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: p.id, active: !(p.active ?? true) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      // optimistic update
      setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !(p.active ?? true) } : x)));
    } catch (e: any) {
      alert(e?.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#fffff0]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Product Manager</h1>
        <div className="flex items-center gap-2">
          <Link href="/" className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50">Home</Link>
          <Link href="/pos" className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50">POS</Link>
        </div>
      </div>

      {error && <div className="mb-3 text-red-600">{error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.id}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-right">{p.price}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={p.active !== false ? 'text-green-700' : 'text-gray-400'}>
                      {p.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={savingId === p.id}
                      className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {savingId === p.id
                        ? 'Saving…'
                        : p.active !== false ? 'Set Inactive' : 'Set Active'}
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={5}>
                    No products
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
