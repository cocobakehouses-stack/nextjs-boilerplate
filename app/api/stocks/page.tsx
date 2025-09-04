// app/stocks/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { PackageSearch, Factory, Plus, Minus, RefreshCw, Loader2, Check, ChevronDown } from 'lucide-react';

type LocationRow = { id: string; label: string };
type Product = { id: number; name: string; price: number; active?: boolean };

type StocksResp = {
  location: string;
  stocks: Record<number, number>; // productId -> qty
};

type AdjustBody = {
  location: string;
  movements: { productId: number; delta: number; reason?: string; billNo?: string }[];
};

const ALL = 'ALL';

export default function StocksPage() {
  // ----- state -----
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [location, setLocation] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [collapseZero, setCollapseZero] = useState(false);

  // ----- init -----
  useEffect(() => {
    (async () => {
      const locRes = await fetch('/api/locations', { cache: 'no-store' });
      const locData = await locRes.json().catch(() => ({}));
      const locs: LocationRow[] = locData?.locations || [];
      const initial = (localStorage.getItem('pos_location') || '').toUpperCase();
      setLocations(locs);
      setLocation(locs.some(l => l.id === initial) ? initial : (locs[0]?.id || ''));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const pRes = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
      const pData = await pRes.json().catch(() => ({}));
      setProducts(pData?.products || []);
    })();
  }, []);

  useEffect(() => {
    if (!location) return;
    refreshStocks();
  }, [location]);

  async function refreshStocks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks?location=${encodeURIComponent(location)}`, { cache: 'no-store' });
      const data: StocksResp = await res.json();
      setStocks(data?.stocks || {});
    } finally {
      setLoading(false);
    }
  }

  // ----- helpers -----
  const list = useMemo(() => {
    const filtered = products
      .filter(p => (search ? p.name.toLowerCase().includes(search.toLowerCase()) : true))
      .map(p => ({ ...p, qty: stocks[p.id] ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return collapseZero ? filtered.filter(p => p.qty !== 0) : filtered;
  }, [products, stocks, search, collapseZero]);

  const totalItems = useMemo(() => {
    return Object.values(stocks).reduce((s, n) => s + (n || 0), 0);
  }, [stocks]);

  // ----- actions -----
  async function adjust(productId: number, delta: number, reason: string) {
    if (!location) return;
    setBusy(true);
    try {
      // optimistic
      setStocks(prev => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
      const body: AdjustBody = { location, movements: [{ productId, delta, reason }] };
      const res = await fetch('/api/stocks/adjust', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Adjust failed');
    } catch (e: any) {
      // fallback refresh
      await refreshStocks();
      alert(e?.message || 'ปรับสต๊อกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function setExact(productId: number) {
    const current = stocks[productId] ?? 0;
    const input = prompt(`ตั้งจำนวนคงเหลือสำหรับสินค้า #${productId}`, String(current));
    if (input === null) return;
    const n = Number(input);
    if (!Number.isFinite(n) || n < 0) {
      alert('ใส่ตัวเลข >= 0');
      return;
    }
    const delta = n - current;
    if (delta === 0) return;
    await adjust(productId, delta, 'adjust');
  }

  // ----- UI -----
  return (
    <main className="min-h-screen bg-[var(--surface-muted)] p-6">
      <HeaderMenu />

      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageSearch className="w-6 h-6 text-[var(--brand)]" />
            Manage Stocks
          </h1>
          <button
            onClick={refreshStocks}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-2"
            disabled={loading}
            title="รีเฟรชข้อมูล"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {/* Controls */}
        <div className="bg-[var(--surface-muted)] border rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">สถานที่</label>
            <div className="relative">
              <Factory className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <select
                className="w-full rounded-lg border pl-9 pr-8 py-2 bg-white"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value.toUpperCase());
                  if (e.target.value) localStorage.setItem('pos_location', e.target.value.toUpperCase());
                }}
              >
                {locations.length === 0 ? (
                  <option>Loading…</option>
                ) : (
                  locations.map(l => (
                    <option key={l.id} value={l.id}>{l.label} ({l.id})</option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">ค้นหาสินค้า</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="พิมพ์ชื่อสินค้า…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={collapseZero}
                onChange={(e) => setCollapseZero(e.target.checked)}
              />
              ซ่อนสินค้าที่สต๊อกเป็น 0
            </label>
          </div>
        </div>

        {/* Summary bar */}
        <div className="mb-4 text-sm text-gray-700 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 bg-[var(--surface-muted)] rounded-lg border px-3 py-2">
            รวมคงเหลือทั้งหมด: <b>{totalItems}</b> ชิ้น
          </span>
          <span className="text-gray-500">รายการที่แสดง: {list.length} / {products.length}</span>
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const qty = p.qty || 0;
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50 transition">
                    <td className="px-3 py-2">{p.id}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right">{p.price}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center justify-center w-14 px-2 py-1 rounded-lg border
                        ${qty === 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white'}
                      `}>
                        {qty}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => adjust(p.id, -1, 'adjust')}
                          disabled={busy || qty <= 0}
                          className="px-2 py-1 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
                          title="ลด 1"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => adjust(p.id, +1, 'restock')}
                          disabled={busy}
                          className="px-2 py-1 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
                          title="เพิ่ม 1 (รับเข้า)"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExact(p.id)}
                          disabled={busy}
                          className="px-3 py-1 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 disabled:opacity-40"
                          title="ตั้งค่าเป็นจำนวนที่ระบุ"
                        >
                          Set exact
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                    {loading ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…</span>
                    ) : search ? 'ไม่พบสินค้าที่ตรงกับคำค้น' : 'ยังไม่มีข้อมูลสินค้า'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 text-xs text-gray-500">
          * “เพิ่ม 1” = restock เข้าสต๊อก, “ลด 1” = ปรับลด/ขายออกเร็ว ๆ, “Set exact” = ตั้งจำนวนคงเหลือให้ตรงตัว
        </div>
      </div>
    </main>
  );
}
