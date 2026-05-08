// app/history/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { Trash2 } from 'lucide-react';

/* ========== Types ========== */
type StockItem = { productId: number; name: string; qty: number; price?: number };
type LocationRow = { id: string; label: string };
type HistoryRow = {
  date: string; time: string; billNo: string;
  items: string; freebies: string;
  totalQty: number; payment: string;
  total: number; freebiesAmount: number; 
  location?: string;
  status?: string;
};
type Product = { id:number; name:string; price:number; active?:boolean };

/* ========== Consts & helpers ========== */
const TZ = 'Asia/Bangkok';
const ALL_ID = 'ALL';

function toBangkokDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

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

export default function HistoryPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [location, setLocation] = useState<string>(ALL_ID);
  const [date, setDate] = useState<string>(toBangkokDateString());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        setProducts(Array.isArray(data?.products) ? data.products : []);
      } catch { setProducts([]); }
    })();
  }, []);

  const priceByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.name.trim()] = Number(p.price) || 0;
    return m;
  }, [products]);

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

  const activeRows = useMemo(() => rows.filter(r => r.status !== 'VOIDED'), [rows]);

  function reduceTotals(all: HistoryRow[]) {
    const count = all.length;
    const freebiesQty = all.reduce((s, r) => s + parseNameQtyList(r.freebies).sum, 0);
    const totalQtyAll = all.reduce((s, r) => s + (Number(r.totalQty) || 0), 0);
    const soldQty = Math.max(0, totalQtyAll - freebiesQty);
    const totalAmount = all.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const freebiesAmount = all.reduce((s, r) => s + (Number(r.freebiesAmount) || 0), 0);

    const byPayment: Record<string, number> = {};
    for (const r of all) {
      const key = (r.payment || '-').toLowerCase().trim();
      byPayment[key] = (byPayment[key] || 0) + (Number(r.total) || 0);
    }
    return { count, soldQty, freebiesQty, totalAmount, freebiesAmount, byPayment };
  }

  async function handleVoid(billNo: string, loc: string | undefined) {
    const targetLoc = loc || location;
    if (targetLoc === ALL_ID) return alert("Please select a location.");
    if (!confirm(`Confirm voiding Bill #${billNo}?`)) return;

    try {
      const res = await fetch('/api/history/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billNo, location: targetLoc }),
      });
      if (res.ok) {
        alert('Bill Voided');
        fetchHistory();
      }
    } catch (err) { console.error(err); }
  }

  async function fetchHistory() {
    setLoading(true);
    try {
      const url = new URL('/api/history', window.location.origin);
      url.searchParams.set('location', location);
      url.searchParams.set('date', date);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: HistoryRow[] = data?.rows || [];
      setRows([...list].sort((a, b) => Number(b.billNo) - Number(a.billNo)));
    } finally { setLoading(false); }
  }

  const computedTotals = useMemo(() => reduceTotals(activeRows), [activeRows]);

  // RESTORED: Lineman Summary Calculation
  const linemanSummary = useMemo(() => {
    const rowsLm = activeRows.filter(r => (r.payment || '').toLowerCase() === 'lineman');
    return rowsLm.length ? reduceTotals(rowsLm) : null;
  }, [activeRows]);

  // RESTORED: Product Sales Breakdown Calculation
  const { productSummaryNonLineman, productSummaryLineman } = useMemo(() => {
    const nonL: Record<string, { qty: number; amount: number }> = {};
    const lm: Record<string, { qty: number; amount: number }> = {};
    const addItems = (bucket: typeof nonL, items: string) => {
      const { map } = parseNameQtyList(items);
      for (const [name, q] of Object.entries(map)) {
        if (!bucket[name]) bucket[name] = { qty: 0, amount: 0 };
        bucket[name].qty += q;
        bucket[name].amount += (priceByName[name] || 0) * q;
      }
    };
    activeRows.forEach(r => {
      if ((r.payment || '').toLowerCase() === 'lineman') addItems(lm, r.items);
      else addItems(nonL, r.items);
    });
    return { productSummaryNonLineman: nonL, productSummaryLineman: lm };
  }, [activeRows, priceByName]);

  const { csvHref, csvFilename } = useMemo(() => {
    if (!location || !date) return { csvHref: '#', csvFilename: '' };
    return { 
      csvHref: `/api/history/csv?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`,
      csvFilename: `history_${location}_${date}.csv`
    };
  }, [location, date]);

  return (
    <main className="min-h-screen bg-[var(--surface-muted)]">
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-2"><HeaderMenu /></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">End of Day – History</h1>

        {/* Controls */}
        <div className="rounded-xl border bg-white p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">สถานที่</label>
            <select value={location} onChange={e => setLocation(e.target.value)} className="rounded border px-3 py-2 w-full bg-white">
              {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded border px-3 py-2 bg-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={fetchHistory} disabled={loading} className="px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)]">
              {loading ? 'Loading...' : 'ดูข้อมูล'}
            </button>
            <a href={csvHref} download={csvFilename} className="px-4 py-2 rounded-lg border bg-white">Export CSV</a>
          </div>
        </div>

       {/* SUMMARY SECTION */}
{activeRows.length > 0 && (
  <div className="space-y-6 mb-6">
    {/* Main Metrics Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white border-l-4 border-blue-500 rounded-xl shadow-sm p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Bills</p>
        <p className="text-2xl font-bold text-gray-900">{computedTotals.count}</p>
      </div>
      
      <div className="bg-white border-l-4 border-indigo-500 rounded-xl shadow-sm p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Sold</p>
        <p className="text-2xl font-bold text-gray-900">
          {computedTotals.soldQty} <span className="text-sm font-normal text-gray-400">pcs</span>
        </p>
      </div>

      <div className="bg-white border-l-4 border-green-500 rounded-xl shadow-sm p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</p>
        <p className="text-2xl font-bold text-green-600">{computedTotals.totalAmount.toLocaleString()} <span className="text-sm">฿</span></p>
      </div>

      <div className="bg-white border-l-4 border-orange-400 rounded-xl shadow-sm p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Freebies Given</p>
        <p className="text-2xl font-bold text-orange-600">{computedTotals.freebiesQty} <span className="text-sm font-normal text-gray-400">items</span></p>
      </div>
    </div>

    {/* Payment & Lineman Details */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Payment Breakdown Card */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <div className="font-semibold text-gray-700 border-b pb-2 mb-3 flex items-center gap-2">
          💰 Payment Breakdown
        </div>
        <div className="space-y-3">
          {Object.entries(computedTotals.byPayment).map(([k, v]) => {
            const isCash = k === 'cash';
            return (
              <div key={k} className="flex justify-between items-center">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isCash ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                  {k}
                </span>
                <span className="font-mono font-semibold">{v.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lineman Box */}
      {linemanSummary && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 shadow-sm">
          <div className="font-semibold text-emerald-800 flex items-center gap-2 mb-2">
            🚚 Lineman Summary
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-emerald-700">
            <div>Bills: <span className="font-bold">{linemanSummary.count}</span></div>
            <div>Qty: <span className="font-bold">{linemanSummary.soldQty}</span></div>
            <div className="col-span-2 mt-1 pt-1 border-t border-emerald-200">
              Total: <span className="text-lg font-bold">{linemanSummary.totalAmount.toLocaleString()} ฿</span>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Product Tables with better styling */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Non-Lineman Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b font-semibold flex items-center gap-2">
          🛒 Product Sales (Walk-in)
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 uppercase text-[10px] bg-gray-50/50">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.entries(productSummaryNonLineman).map(([n, v]) => (
              <tr key={n} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{n}</td>
                <td className="px-4 py-2 text-right tabular-nums">{v.qty}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{v.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lineman Table */}
      {Object.keys(productSummaryLineman).length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-emerald-50 px-4 py-3 border-b font-semibold text-emerald-800 flex items-center gap-2">
            📦 Product Sales (Lineman)
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-emerald-600 uppercase text-[10px] bg-emerald-50/50">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {Object.entries(productSummaryLineman).map(([n, v]) => (
                <tr key={n} className="hover:bg-emerald-50/30">
                  <td className="px-4 py-2 font-medium">{n}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{v.qty}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{v.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
)}

        {/* TABLE SECTION */}
        <div className="rounded-xl border bg-white p-4">
          {rows.length === 0 ? <div className="text-gray-500 text-center py-10">No records found.</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="[&>th]:py-3 [&>th]:px-2 text-left">
                    {location === ALL_ID && <th>Location</th>}
                    <th>Time</th><th>Bill</th><th>Items</th><th>Total</th><th>Payment</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const isVoided = r.status === 'VOIDED';
                    const pay = (r.payment || '').toLowerCase();
                    let badgeClass = "bg-blue-100 text-blue-700";
                    if (isVoided) badgeClass = "bg-gray-200 text-gray-600";
                    else if (pay === 'cash') badgeClass = "bg-orange-100 text-orange-900";
                    
                    return (
                      <tr key={idx} className={`border-b last:border-0 ${isVoided ? 'bg-gray-50 opacity-60' : ''}`}>
                        {location === ALL_ID && <td className="p-2">{r.location}</td>}
                        <td className="p-2">{r.time}</td>
                        <td className="p-2 font-mono">{r.billNo}</td>
                        <td className="p-2 max-w-[300px] truncate">{r.items}</td>
                        <td className="p-2 font-bold">{isVoided ? '0.00' : Number(r.total).toFixed(2)}</td>
                        <td className="p-2">
                           <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${badgeClass}`}>
                             {isVoided ? 'VOIDED' : r.payment}
                           </span>
                        </td>
                        <td className="p-2">
                          {!isVoided && (
                            <button onClick={() => handleVoid(r.billNo, r.location)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
