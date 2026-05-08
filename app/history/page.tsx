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
          <div className="rounded-xl border bg-white p-4 mb-6 space-y-4">
            <div className="font-semibold text-lg border-b pb-2">Sales Summary</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div><p className="text-xs text-gray-500">Bills</p><p className="font-bold">{computedTotals.count}</p></div>
               <div><p className="text-xs text-gray-500">Qty Sold</p><p className="font-bold">{computedTotals.soldQty}</p></div>
               <div><p className="text-xs text-gray-500">Total Sales</p><p className="font-bold text-green-600">{computedTotals.totalAmount.toFixed(2)} THB</p></div>
               <div><p className="text-xs text-gray-500">Freebies</p><p className="font-bold text-orange-600">{computedTotals.freebiesAmount.toFixed(2)} THB</p></div>
            </div>
            
            {/* Re-added Payment Breakdown */}
            <div className="pt-2 border-t text-sm text-gray-700">
                <span className="font-semibold">By Payment: </span>
                {Object.entries(computedTotals.byPayment).map(([k, v], i) => (
                    <span key={k}>
                        {i > 0 && " | "}
                        <span className="capitalize">{k}</span>: {v.toFixed(2)} THB
                    </span>
                ))}
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
                    
                    // Logic for custom badge colors
                    let badgeClass = "bg-blue-100 text-blue-700"; // Default
                    if (isVoided) badgeClass = "bg-gray-200 text-gray-600";
                    else if (pay === 'cash') badgeClass = "bg-orange-100 text-orange-900"; // Brown/Orange theme
                    
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
