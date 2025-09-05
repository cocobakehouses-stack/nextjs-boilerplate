// app/stocks/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import {
  Boxes,
  History as HistoryIcon,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
  Download,
  Calendar,
} from 'lucide-react';

type StockItem = {
  productId: number;
  name: string;
  // ปริมาณคงเหลือของสาขาที่เลือก
  qty: number;
  // ราคาหรือข้อมูลเสริม (optional)
  price?: number;
};

type MovementRow = {
  id?: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm:ss
  location: string;
  productId: number;
  productName: string;
  delta: number;  // + เพิ่มสต๊อก, - ลดสต๊อก
  reason?: string;
  user?: string;
};

type Tab = 'stock' | 'movements';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function StocksPage() {
  // -------- Location & Tabs --------
  const [location, setLocation] = useState<LocationId | null>(null);
  const [tab, setTab] = useState<Tab>('stock');

  useEffect(() => {
    try {
      const saved = (localStorage.getItem('pos_location') as LocationId | null) || null;
      if (saved) setLocation(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (location) {
      try { localStorage.setItem('pos_location', location); } catch {}
    }
  }, [location]);

  // =========================================================
  // ================   TAB 1: CURRENT STOCK   ===============
  // =========================================================
  const [loadingStock, setLoadingStock] = useState(false);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const setPendingOn = (id: number, on: boolean) => {
    setPendingIds(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  async function loadStocks() {
    if (!location) return;
    setLoadingStock(true);
    try {
      const res = await fetch(`/api/stocks?location=${encodeURIComponent(location)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setStocks(data?.stocks || []);
    } catch (e) {
      console.error('Load stocks error', e);
      setStocks([]);
    } finally {
      setLoadingStock(false);
    }
  }

  useEffect(() => { if (tab === 'stock') loadStocks(); }, [location, tab]);

  async function mutateQty(p: StockItem, kind: 'inc'|'dec'|'set', setTo?: number) {
    if (!location) return;
    const delta = kind === 'inc' ? 1 : kind === 'dec' ? -1 : 0;
    const nextQty = kind === 'set' ? Math.max(0, Number(setTo || 0)) : Math.max(0, p.qty + delta);

    // optimistic update
    setStocks(prev => prev.map(x => x.productId === p.productId ? { ...x, qty: nextQty } : x));
    setPendingOn(p.productId, true);

    try {
      const body: any = kind === 'set'
        ? { setTo: nextQty, reason: 'manual set' }
        : { delta, reason: delta > 0 ? 'manual +1' : 'manual -1' };

      const res = await fetch(`/api/stocks/${p.productId}?location=${encodeURIComponent(location)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Update stock failed');
    } catch (e) {
      // revert
      setStocks(prev => prev.map(x => x.productId === p.productId ? { ...x, qty: p.qty } : x));
      alert('อัปเดตสต๊อกไม่สำเร็จ');
    } finally {
      setPendingOn(p.productId, false);
    }
  }

  // =========================================================
  // ==============   TAB 2: MOVEMENT HISTORY   =============
  // =========================================================
  const [mvLoading, setMvLoading] = useState(false);
  const [mvRows, setMvRows] = useState<MovementRow[]>([]);
  const [mvStart, setMvStart] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
  });
  const [mvEnd, setMvEnd] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  });

  async function loadMovements() {
    if (!location || !mvStart || !mvEnd) return;
    setMvLoading(true);
    try {
      const q = new URLSearchParams({
        location: location,
        start: mvStart,
        end: mvEnd,
      }).toString();
      const res = await fetch(`/api/stocks/movements?${q}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: MovementRow[] = data?.movements || [];
      // เรียงเวลาจากใหม่ -> เก่า
      list.sort((a, b) => {
        const ka = `${a.date}T${a.time}`;
        const kb = `${b.date}T${b.time}`;
        return kb.localeCompare(ka);
      });
      setMvRows(list);
    } catch (e) {
      console.error('Load movements error', e);
      setMvRows([]);
    } finally {
      setMvLoading(false);
    }
  }

  useEffect(() => { if (tab === 'movements') loadMovements(); }, [location, tab]);

  const csvHref = useMemo(() => {
    if (!location || !mvStart || !mvEnd) return '#';
    const u = new URL('/api/stocks/movements/csv', window.location.origin);
    u.searchParams.set('location', location);
    u.searchParams.set('start', mvStart);
    u.searchParams.set('end', mvEnd);
    return u.toString();
  }, [location, mvStart, mvEnd]);

  // =========================================================
  // ======================   RENDER   =======================
  // =========================================================
  return (
    <main className="min-h-screen bg-[var(--surface-muted)] p-6">
      <HeaderMenu />

      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6">
        {/* Title */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[var(--brand)]" />
            Stocks
          </h1>
          {/* Location */}
          <div className="min-w-[220px]">
            <LocationPicker value={location} onChange={(id) => setLocation(id as LocationId)} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            className={cx(
              'px-3 py-2 rounded-lg border text-sm flex items-center gap-2',
              tab === 'stock' ? 'bg-[var(--brand)] text-[var(--brand-contrast)] border-[var(--brand)]' : 'hover:bg-gray-50'
            )}
            onClick={() => setTab('stock')}
          >
            <Boxes className="w-4 h-4" /> Current Stock
          </button>
          <button
            className={cx(
              'px-3 py-2 rounded-lg border text-sm flex items-center gap-2',
              tab === 'movements' ? 'bg-[var(--brand)] text-[var(--brand-contrast)] border-[var(--brand)]' : 'hover:bg-gray-50'
            )}
            onClick={() => setTab('movements')}
          >
            <HistoryIcon className="w-4 h-4" /> Movement History
          </button>
        </div>

        {/* ===== TAB: CURRENT STOCK ===== */}
        {tab === 'stock' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {location ? <>Location: <b>{location}</b></> : 'กรุณาเลือกสถานที่'}
              </div>
              <button
                onClick={loadStocks}
                className="px-3 py-2 rounded-lg border flex items-center gap-2 hover:bg-gray-50"
                disabled={!location || loadingStock}
              >
                {loadingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </button>
            </div>

            <div className="overflow-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((p) => {
                    const isPending = pendingIds.has(p.productId);
                    return (
                      <tr key={p.productId} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.qty}</td>
                        <td className="px-3 py-2">
                          <div className={cx('flex items-center justify-center gap-2', isPending && 'opacity-60')}>
                            <button
                              className="px-2 py-1 rounded border hover:bg-gray-50"
                              onClick={() => mutateQty(p, 'dec')}
                              disabled={isPending}
                              title="ลด -1"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              className="px-2 py-1 rounded border hover:bg-gray-50"
                              onClick={() => mutateQty(p, 'inc')}
                              disabled={isPending}
                              title="เพิ่ม +1"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            {/* Set exact */}
                            <SetExactButton
                              qty={p.qty}
                              onSet={(val) => mutateQty(p, 'set', val)}
                              disabled={isPending}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {stocks.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-gray-600">
                        {loadingStock ? 'กำลังโหลด…' : 'ไม่มีสินค้าในสาขานี้'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===== TAB: MOVEMENT HISTORY ===== */}
        {tab === 'movements' && (
          <section className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="text-sm text-gray-600">
                {location ? <>Location: <b>{location}</b></> : 'กรุณาเลือกสถานที่'}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Start
                </label>
                <input
                  type="date"
                  className="rounded border px-3 py-2 bg-white"
                  value={mvStart}
                  onChange={(e) => setMvStart(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> End
                </label>
                <input
                  type="date"
                  className="rounded border px-3 py-2 bg-white"
                  value={mvEnd}
                  onChange={(e) => setMvEnd(e.target.value)}
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <a
                  href={csvHref}
                  onClick={(e) => { if (csvHref === '#') e.preventDefault(); }}
                  className="px-3 py-2 rounded-lg border flex items-center gap-2 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" /> CSV
                </a>
                <button
                  onClick={loadMovements}
                  className="px-3 py-2 rounded-lg border flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
                  disabled={!location || !mvStart || !mvEnd || mvLoading}
                >
                  {mvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Load
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Δ</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                    <th className="px-3 py-2 text-left">By</th>
                  </tr>
                </thead>
                <tbody>
                  {mvRows.map((r, i) => (
                    <tr key={r.id ?? `${r.date}-${r.time}-${r.productId}-${i}`} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2">{r.time}</td>
                      <td className="px-3 py-2">{r.productName}</td>
                      <td className={cx('px-3 py-2 text-right tabular-nums', r.delta > 0 ? 'text-green-700' : r.delta < 0 ? 'text-red-700' : '')}>
                        {r.delta > 0 ? `+${r.delta}` : r.delta}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.reason || '-'}</td>
                      <td className="px-3 py-2">{r.user || '-'}</td>
                    </tr>
                  ))}
                  {mvRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-600">
                        {mvLoading ? 'กำลังโหลด…' : 'ไม่มีประวัติในช่วงที่เลือก'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/** ปุ่ม Set exact (inline) */
function SetExactButton({
  qty,
  onSet,
  disabled,
}: {
  qty: number;
  onSet: (val: number) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>(() => String(qty));

  useEffect(() => { setVal(String(qty)); }, [qty]);

  if (!editing) {
    return (
      <button
        className="px-2 py-1 rounded border hover:bg-gray-50 text-xs"
        onClick={() => setEditing(true)}
        disabled={disabled}
        title="ตั้งค่าจำนวนตรงๆ"
      >
        Set
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className="w-20 rounded border px-2 py-1 text-sm"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        min={0}
      />
      <button
        className="px-2 py-1 rounded border hover:bg-gray-50 text-xs"
        onClick={() => {
          const n = Number(val);
          if (Number.isFinite(n) && n >= 0) onSet(n);
          setEditing(false);
        }}
      >
        OK
      </button>
      <button
        className="px-2 py-1 rounded border hover:bg-gray-50 text-xs"
        onClick={() => { setVal(String(qty)); setEditing(false); }}
      >
        Cancel
      </button>
    </div>
  );
}
