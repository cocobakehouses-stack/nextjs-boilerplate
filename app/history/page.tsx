// app/history/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';

/* ========== Types ========== */
type StockItem = { productId: number; name: string; qty: number; price?: number };

type LocationRow = { id: string; label: string };
type HistoryRow = {
  date: string; time: string; billNo: string;
  items: string; freebies: string;
  totalQty: number; payment: string;
  total: number; freebiesAmount: number; location?: string;
};

type Product = { id:number; name:string; price:number; active?:boolean };

/* ========== Consts & helpers ========== */
const TZ = 'Asia/Bangkok';
const ALL_ID = 'ALL';

function toBangkokDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

// parse "Name x2; Another x3" => { "Name":2, "Another":3 } + sum
function parseNameQtyList(s: string): { map: Record<string, number>, sum: number } {
  const map: Record<string, number> = {};
  let sum = 0;
  (s || '').split(';').forEach(raw => {
    const it = raw.trim();
    if (!it) return;
    const m = it.match(/(.+?)\s*x\s*(\d+)/i);
    if (!m) return;
    const name = m[1].trim();
    const q = Number(m[2]) || 0;
    map[name] = (map[name] || 0) + q;
    sum += q;
  });
  return { map, sum };
}

/* ========== Page ========== */
export default function HistoryPage() {
  // ---- controls
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [location, setLocation] = useState<string>(ALL_ID);
  const [date, setDate] = useState<string>(toBangkokDateString());

  // ---- history rows
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [totalsFromApi, setTotalsFromApi] = useState<{
    count: number; totalQty: number; totalAmount: number; freebiesAmount: number;
    byPayment: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // ---- products (for price lookup of Product Sales)
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        setProducts(Array.isArray(data?.products) ? data.products : []);
      } catch {
        setProducts([]);
      }
    })();
  }, []);
  const priceByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.name.trim()] = Number(p.price) || 0;
    return m;
  }, [products]);

  // ---- load locations (+ restore saved)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/locations', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const list: LocationRow[] = data?.locations || [];
        const final = [{ id: ALL_ID, label: 'All Locations' }, ...list];
        setLocations(final);

        const saved = (localStorage.getItem('pos_location') || ALL_ID).toUpperCase();
        setLocation(final.some(l => l.id === saved) ? saved : ALL_ID);
      } catch {
        setLocations([{ id: ALL_ID, label: 'All Locations' }]);
        setLocation(ALL_ID);
      }
    };
    load();
  }, []);

  // ---- totals reducer (แยก Qty ขาย ออกจาก Freebies)
  function reduceTotals(all: HistoryRow[]) {
    const count = all.length;
    const freebiesQty = all.reduce((s, r) => s + parseNameQtyList(r.freebies).sum, 0);
    const totalQtyAll = all.reduce((s, r) => s + (Number(r.totalQty) || 0), 0);
    const soldQty = Math.max(0, totalQtyAll - freebiesQty);

    const totalAmount = all.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const freebiesAmount = all.reduce((s, r) => s + (Number(r.freebiesAmount) || 0), 0);

    const byPayment: Record<string, number> = {};
    for (const r of all) {
      const key = (r.payment || '-').toString();
      byPayment[key] = (byPayment[key] || 0) + (Number(r.total) || 0);
    }
    return { count, soldQty, freebiesQty, totalAmount, freebiesAmount, byPayment };
  }

  // ---- fetch history
  async function fetchHistory() {
    setLoading(true);
    try {
      const url = new URL('/api/history', window.location.origin);
      url.searchParams.set('location', location);
      url.searchParams.set('date', date);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      const list: HistoryRow[] = data?.rows || [];
      const sorted = [...list].sort((a, b) => {
        const na = Number(a.billNo); const nb = Number(b.billNo);
        if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
        return String(b.billNo).localeCompare(String(a.billNo));
      });

      setRows(sorted);
      setTotalsFromApi(data?.totals || null);
    } finally {
      setLoading(false);
    }
  }

  // ---- computed totals (สูตรใหม่)
  const computedTotals = useMemo(() => reduceTotals(rows), [rows]);

  // ---- Lineman summary (ใช้สูตรใหม่)
  const linemanSummary = useMemo(() => {
    const rowsLm = rows.filter(r => (r.payment || '').toLowerCase() === 'lineman');
    return rowsLm.length ? reduceTotals(rowsLm) : null;
  }, [rows]);

  // ---- Product summary (Amount = unit price * qty)
  const { productSummaryNonLineman, productSummaryLineman } = useMemo(() => {
    const nonL: Record<string, { qty: number; amount: number }> = {};
    const lm: Record<string, { qty: number; amount: number }> = {};

    const addItems = (bucket: typeof nonL, items: string) => {
      const { map } = parseNameQtyList(items);
      for (const [name, q] of Object.entries(map)) {
        const qty = Number(q) || 0;
        if (!bucket[name]) bucket[name] = { qty: 0, amount: 0 };
        bucket[name].qty += qty;
        const unit = priceByName[name] || 0;
        bucket[name].amount += unit * qty;
      }
    };

    rows.forEach(r => {
      if ((r.payment || '').toLowerCase() === 'lineman') addItems(lm, r.items);
      else addItems(nonL, r.items);
    });

    return { productSummaryNonLineman: nonL, productSummaryLineman: lm };
  }, [rows, priceByName]);

  // ---- CSV
  const { csvHref, csvFilename } = useMemo(() => {
    if (!location || !date) return { csvHref: '#', csvFilename: '' };
    const href = `/api/history/csv?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`;
    const fn = `history_${location}_${date}.csv`;
    return { csvHref: href, csvFilename: fn };
  }, [location, date]);

  /* ===== Today’s stock (collapsible) ===== */
  const [stockOpen, setStockOpen] = useState<boolean>(false);
  const [stockLoading, setStockLoading] = useState<boolean>(false);
  const [stockRows, setStockRows] = useState<StockItem[]>([]);
  const [stockSearch, setStockSearch] = useState<string>("");

  const filteredStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    let arr = stockRows;
    if (q) {
      arr = arr.filter(s =>
        [s.productId, s.name, s.qty, s.price].join(" ").toLowerCase().includes(q)
      );
    }
    return [...arr].sort((a,b)=>a.name.localeCompare(b.name));
  }, [stockRows, stockSearch]);

  async function loadTodayStock() {
    if (!location || location === ALL_ID) {
      setStockRows([]);
      return;
    }
    setStockLoading(true);
    try {
      const res = await fetch(`/api/stocks?location=${encodeURIComponent(location)}`, { cache: 'no-store' });
      const data = await res.json().catch(()=> ({}));
      const list: StockItem[] = Array.isArray(data?.stocks) ? data.stocks : (data?.stock || []);
      setStockRows(list || []);
    } catch (e) {
      console.error('loadTodayStock error', e);
      setStockRows([]);
    } finally {
      setStockLoading(false);
    }
  }

  useEffect(() => {
    if (stockOpen) loadTodayStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, stockOpen]);

  /* ========== Render ========== */
  return (
    <main className="min-h-screen bg-[var(--surface-muted)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <HeaderMenu />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">End of Day – History</h1>

        {/* Controls */}
        <div className="rounded-xl border bg-white p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">สถานที่</label>
            <select
              value={location}
              onChange={e => {
                const v = e.target.value;
                setLocation(v);
                if (v && v !== ALL_ID) {
                  try { localStorage.setItem('pos_location', v); } catch {}
                }
              }}
              className="rounded border px-3 py-2 w-full bg-white"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.label}{l.id !== ALL_ID ? ` (${l.id})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">วันที่</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded border px-3 py-2 bg-white"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              className="px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 disabled:opacity-40"
              disabled={!location || !date || loading}
            >
              {loading ? 'กำลังโหลด…' : 'ดูข้อมูล'}
            </button>

            {/* Export CSV (บน) */}
            <a
              href={csvHref}
              download={csvFilename}
              onClick={(e) => { if (csvHref === '#') e.preventDefault(); }}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
              aria-disabled={!location || !date}
            >
              Export CSV
            </a>
          </div>
        </div>

        {/* SUMMARY */}
        {(totalsFromApi || rows.length > 0) && (
          <div className="rounded-xl border bg-white p-4 mb-6 space-y-4">
            <div>
              <div className="font-semibold mb-2">Summary</div>
              <div>
                Bills: {computedTotals.count}
                {' '}| Qty: {computedTotals.soldQty}
                {' '}| Freebies Qty: {computedTotals.freebiesQty}
              </div>
              <div>Total: {computedTotals.totalAmount.toFixed(2)} THB</div>
              <div>Freebies: {computedTotals.freebiesAmount.toFixed(2)} THB</div>
              <div className="text-gray-700">
                By Payment:{' '}
                {Object.entries(computedTotals.byPayment)
                  .map(([k, v]) => `${k}: ${v.toFixed(2)} THB`)
                  .join(' | ')}
              </div>
            </div>

            {linemanSummary && (
              <div className="p-3 border rounded bg-gray-50">
                <div className="font-semibold">🚚 Lineman Summary</div>
                <div>
                  Bills: {linemanSummary.count}
                  {' '}| Qty: {linemanSummary.soldQty}
                  {' '}| Freebies Qty: {linemanSummary.freebiesQty}
                </div>
                <div>Total: {linemanSummary.totalAmount.toFixed(2)} THB</div>
              </div>
            )}

            {/* Product Summary Non-Lineman */}
            <div>
              <div className="font-semibold mb-2">🛒 Product Sales (Non-Lineman)</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2">Product</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(productSummaryNonLineman).map(([n, v]) => (
                      <tr key={n} className="border-t">
                        <td className="p-2">{n}</td>
                        <td className="p-2 text-right">{v.qty}</td>
                        <td className="p-2 text-right">{v.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                    {Object.keys(productSummaryNonLineman).length === 0 && (
                      <tr><td colSpan={3} className="p-2 text-gray-500">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Summary Lineman */}
            {Object.keys(productSummaryLineman).length > 0 && (
              <div>
                <div className="font-semibold mb-2">📦 Product Sales (Lineman)</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left p-2">Product</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(productSummaryLineman).map(([n, v]) => (
                        <tr key={n} className="border-t">
                          <td className="p-2">{n}</td>
                          <td className="p-2 text-right">{v.qty}</td>
                          <td className="p-2 text-right">{v.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {Object.keys(productSummaryLineman).length === 0 && (
                        <tr><td colSpan={3} className="p-2 text-gray-500">No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Today’s stock (collapsible) */}
        <div className="rounded-xl border bg-white mb-6">
          <button
            onClick={() => setStockOpen(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3"
            aria-expanded={stockOpen}
          >
            <div className="font-semibold">
              Today’s stock {location !== ALL_ID ? `(${location})` : ''}
            </div>
            <span className="text-sm text-gray-600">
              {stockOpen ? 'ซ่อน' : 'แสดง'}
            </span>
          </button>

          {stockOpen && (
            <div className="px-4 pb-4 space-y-3">
              {/* Controls */}
              <div className="flex items-center gap-2">
                <input
                  value={stockSearch}
                  onChange={(e)=>setStockSearch(e.target.value)}
                  className="rounded border px-3 py-2 bg-white"
                  placeholder="ค้นหาสินค้า…"
                />
                <button
                  onClick={loadTodayStock}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
                  disabled={stockLoading || !location || location===ALL_ID}
                >
                  {stockLoading ? 'กำลังโหลด…' : 'Reload'}
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Product</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((s)=>(
                      <tr key={s.productId} className="border-t">
                        <td className="p-2">{s.name}</td>
                        <td className="p-2 text-right tabular-nums">{s.qty}</td>
                        <td className="p-2 text-right tabular-nums">
                          {typeof s.price === 'number' ? s.price.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                    {!stockLoading && filteredStock.length === 0 && (
                      <tr><td colSpan={3} className="p-3 text-center text-gray-600">
                        {location===ALL_ID ? 'เลือกสาขาก่อนจึงจะแสดงสต๊อก' : 'ไม่พบรายการ'}
                      </td></tr>
                    )}
                    {stockLoading && (
                      <tr><td colSpan={3} className="p-3 text-center text-gray-600">กำลังโหลด…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="rounded-xl border bg-white p-4">
          {rows.length === 0 ? (
            <div className="text-gray-600">{loading ? 'กำลังโหลด…' : 'ไม่มีข้อมูล'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left border-b">
                  <tr className="[&>th]:py-2 [&>th]:px-2">
                    {location === ALL_ID && <th>Location</th>}
                    <th>Time</th>
                    <th>Bill</th>
                    <th>Items</th>
                    <th>Qty</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Freebies</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-b last:border-0 [&>td]:py-2 [&>td]:px-2">
                      {location === ALL_ID && <td>{r.location}</td>}
                      <td>{r.time}</td>
                      <td>{r.billNo}</td>
                      <td className="max-w-[520px] whitespace-pre-wrap break-words">{r.items}</td>
                      <td>{r.totalQty}</td>
                      <td>{r.payment}</td>
                      <td>{(Number(r.total) || 0).toFixed(2)}</td>
                      <td className="max-w-[320px] whitespace-pre-wrap break-words">{r.freebies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Export CSV (ล่าง) */}
          {rows.length > 0 && (
            <div className="mt-4">
              <a
                href={csvHref}
                download={csvFilename}
                onClick={(e) => { if (csvHref === '#') e.preventDefault(); }}
                className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40 inline-block"
                aria-disabled={!location || !date}
              >
                Export CSV
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
