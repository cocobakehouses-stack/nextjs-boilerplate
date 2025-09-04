// app/products/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Loader2, Search, ArrowUpDown, ChevronUp, ChevronDown, Inbox } from 'lucide-react';
import HeaderMenu from '../components/HeaderMenu';

type Product = { id: number; name: string; price: number; active?: boolean };
type SortKey = 'id' | 'name' | 'price' | 'active';
type SortDir = 'asc' | 'desc';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<number>>(new Set()); // ids กำลังอัพเดต

  // UI helpers
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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
    // optimistic
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
      // revert
      setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: current } : x)));
      alert('Toggle failed');
    } finally {
      setPendingOn(p.id, false);
    }
  }

  useEffect(() => { load(); }, []);

  // filter + sort
  const filteredSorted = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? products.filter(p =>
          String(p.id).includes(term) ||
          p.name.toLowerCase().includes(term) ||
          String(p.price).includes(term)
        )
      : products;

    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      const av = sortKey === 'active' ? Number(a.active ?? true) : (a as any)[sortKey];
      const bv = sortKey === 'active' ? Number(b.active ?? true) : (b as any)[sortKey];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [products, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-60" />
    ) : sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
    );

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] p-6">
      <HeaderMenu />

      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-6">
        {/* Title */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-[var(--brand)]" />
            Manage Products
          </h1>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name/price/id…"
              className="pl-9 pr-3 py-2 rounded-lg border bg-white text-sm min-w-[220px]"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลดสินค้า…
          </div>
        ) : filteredSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-600 border rounded-xl py-10">
            <Inbox className="w-10 h-10 mb-2" />
            <div className="font-medium">ไม่พบสินค้า</div>
            <div className="text-sm text-gray-500">ลองเปลี่ยนคำค้นหรือเคลียร์ช่องค้นหา</div>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <button
                      onClick={() => toggleSort('id')}
                      className="inline-flex items-center hover:opacity-80"
                    >
                      ID <SortIcon k="id" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center hover:opacity-80"
                    >
                      Name <SortIcon k="name" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleSort('price')}
                      className="inline-flex items-center hover:opacity-80"
                    >
                      Price <SortIcon k="price" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleSort('active')}
                      className="inline-flex items-center hover:opacity-80"
                    >
                      Active <SortIcon k="active" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((p) => {
                  const isActive = p.active ?? true;
                  const isPending = pending.has(p.id);
                  return (
                    <tr key={p.id} className="border-t hover:bg-gray-50 transition">
                      <td className="px-3 py-2">{p.id}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-right">
                        {Number(p.price).toLocaleString('en-US')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <label
                          className={`inline-flex items-center select-none ${isPending ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                          title={isActive ? 'Active' : 'Inactive'}
                        >
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!isActive}
                            onChange={() => toggleActive(p)}
                            disabled={isPending}
                            aria-label={`Toggle ${p.name}`}
                          />
                          <div
                            className="
                              relative w-11 h-6 rounded-full bg-gray-200 transition
                              peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-[var(--brand)]
                              peer-checked:bg-green-600
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                              after:w-5 after:h-5 after:rounded-full after:bg-white after:border after:transition-all
                              peer-checked:after:translate-x-5
                            "
                          />
                          <span className="ml-2 text-xs text-gray-600" aria-live="polite">
                            {isPending ? 'Saving…' : isActive ? 'Active' : 'Inactive'}
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
