'use client';

import { useEffect, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';

export default function POSPage() {
  // ... โค้ดอื่น

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#fffff0]">
      <HeaderMenu />   {/* ✅ เมนู */}
      {/* ของเดิมทั้งหมด */}
      
type Product = { id: number; name: string; price: number; active?: boolean };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/products', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setProducts(data?.products || []);
    setLoading(false);
  }

  async function toggleActive(p: Product) {
    const newActive = !p.active;
    const res = await fetch(`/api/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: newActive }),
    });
    if (!res.ok) {
      alert('Toggle failed');
      return;
    }
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="min-h-screen bg-[#fffff0] p-4 sm:p-6 lg:p-8">
      <HeaderMenu />
      <h1 className="text-2xl font-bold mb-4">Manage Products</h1>

      {loading ? <p>Loading…</p> : (
        <div className="rounded-xl border bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.id}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-right">{p.price}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleActive(p)}
                      className={
                        p.active
                          ? 'px-2 py-1 rounded bg-green-600 text-white'
                          : 'px-2 py-1 rounded bg-gray-400 text-white'
                      }
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
