'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { Trash2, Download, Gift, ShoppingBag, Truck, Search, Loader2 } from 'lucide-react';

/* ========== Types & Helpers (Unchanged) ========== */
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

  // 1. Initial Load: Only fetch static data (Locations & Products)
  useEffect(() => {
    (async () => {
      try {
        const [locRes, prodRes] = await Promise.all([
          fetch('/api/locations'),
          fetch('/api/products?activeOnly=0')
        ]);
        const locData = await locRes.json();
        const prodData = await prodRes.json();
        
        const list = locData?.locations || [];
        setLocations([{ id: ALL_ID, label: 'All Locations' }, ...list]);
        setProducts(prodData.products || []);
        
        const saved = (localStorage.getItem('pos_location') || ALL_ID).toUpperCase();
        setLocation(list.some((l: LocationRow) => l.id === saved) ? saved : ALL_ID);
      } catch (err) { console.error("Initial load failed", err); }
    })();
  }, []);

  // 2. The "Look Up" Function (Manual Sync)
  async function fetchHistory() {
    if (loading) return;
    setLoading(true);
    try {
      const url = new URL('/api/history', window.location.origin);
      url.searchParams.set('location', location);
      url.searchParams.set('date', date);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json();
      const list: HistoryRow[] = data?.rows || [];
      setRows([...list].sort((a, b) => Number(b.billNo) - Number(a.billNo)));
    } catch (err) {
      alert("Failed to sync with Google Sheets");
    } finally {
      setLoading(false);
    }
  }

  // DELETED: The useEffect that auto-reloaded on every [location, date] change.
  // This is what was causing the buffering/stuttering.

  /* ========== Summarization Logic ========== */
  const activeRows = useMemo(() => rows.filter(r => r.status !== 'VOIDED'), [rows]);

  const priceByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.name.trim()] = Number(p.price) || 0;
    return m;
  }, [products]);

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

  const computedTotals = useMemo(() => reduceTotals(activeRows), [activeRows]);

  const { productSummaryNonLineman, productSummaryLineman, freebieSummary } = useMemo(() => {
    const nonL: Record<string, { qty: number; amount: number }> = {};
    const lm: Record<string, { qty: number; amount: number }> = {};
    const free: Record<string, { qty: number; amount: number }> = {};

    const addItems = (bucket: any, itemsStr: string) => {
      const { map } = parseNameQtyList(itemsStr);
      for (const [name, q] of Object.entries(map)) {
        if (!bucket[name]) bucket[name] = { qty: 0, amount: 0 };
        bucket[name].qty += q;
        bucket[name].amount += (priceByName[name] || 0) * q;
      }
    };

    activeRows.forEach(r => {
      const isLM = (r.payment || '').toLowerCase() === 'lineman';
      addItems(isLM ? lm : nonL, r.items);
      if (r.freebies) addItems(free, r.freebies);
    });

    return { productSummaryNonLineman: nonL, productSummaryLineman: lm, freebieSummary: free };
  }, [activeRows, priceByName]);

  async function handleVoid(billNo: string, rowLoc: string | undefined) {
    const targetLoc = rowLoc || location;
    if (targetLoc === ALL_ID) return alert("Select a specific location to void.");
    if (!confirm(`VOID BILL #${billNo}?`)) return;

    try {
      const res = await fetch('/api/history/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billNo, location: targetLoc }),
      });
      if (res.ok) fetchHistory();
    } catch (err) { alert("Error voiding bill"); }
  }

  const csvHref = `/api/history/csv?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`;

  return (
    <main className="min-h-screen bg-[#fffff0] pb-20">
      <div className="sticky top-0 z-50 bg-white border-b-4 border-black px-4 py-4"><HeaderMenu /></div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* HEADER & FILTERS */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-black">End of Day</h1>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Management Dashboard</p>
          </div>

          <div className="bg-white border-4 border-black p-4 rounded-3xl shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-end gap-3 flex-1 max-w-2xl">
            <div className="w-full space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Location</label>
              <select value={location} onChange={e => setLocation(e.target.value)} className="w-full rounded-xl border-2 border-black p-2 font-bold text-sm bg-white">
                {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div className="w-full space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border-2 border-black p-2 font-bold text-sm" />
            </div>
            <button 
              onClick={fetchHistory} 
              disabled={loading}
              className="w-full sm:w-auto px-8 py-2 bg-[#ac0000] text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 mb-[2px] disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />} Look Up
            </button>
          </div>

          <a href={csvHref} download className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-black uppercase text-xs self-end shadow-[4px_4px_0px_rgba(172,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all">
            <Download size={14} /> Export CSV
          </a>
        </header>

        {/* SUMMARY METRICS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border-4 border-black p-6 rounded-[2rem] shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Bills</p>
            <p className="text-3xl font-black">{computedTotals.count}</p>
          </div>
          <div className="bg-white border-4 border-black p-6 rounded-[2rem] shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Qty Sold</p>
            <p className="text-3xl font-black">{computedTotals.soldQty} <span className="text-sm">pcs</span></p>
          </div>
          <div className="bg-white border-4 border-black p-6 rounded-[2rem] shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Revenue</p>
            <p className="text-3xl font-black text-[#ac0000]">{computedTotals.totalAmount.toLocaleString()} ฿</p>
          </div>
          <div className="bg-white border-4 border-black p-6 rounded-[2rem] shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Freebies</p>
            <p className="text-3xl font-black text-orange-500">{computedTotals.freebiesQty}</p>
          </div>
        </section>

        {/* MARKETING SUMMARY */}
        {Object.keys(freebieSummary).length > 0 && (
          <section className="bg-orange-50 border-4 border-orange-200 rounded-[2rem] p-6">
            <div className="flex items-center gap-2 mb-6">
              <Gift className="text-orange-600" />
              <h2 className="text-xl font-black uppercase italic tracking-tight text-orange-900">Marketing Freebie Summary</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(freebieSummary).map(([name, data]) => (
                <div key={name} className="bg-white p-4 rounded-2xl border-2 border-orange-100 flex justify-between items-center shadow-sm">
                  <div className="truncate pr-2">
                    <p className="font-black text-xs uppercase text-gray-800 truncate">{name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Cost: {data.amount.toLocaleString()} ฿</p>
                  </div>
                  <p className="text-2xl font-black text-orange-600">x{data.qty}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DETAILED TABLES */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white border-4 border-black rounded-[2.5rem] overflow-hidden shadow-[8px_8px_0px_rgba(0,0,0,1)]">
            <div className="p-6 border-b-4 border-black bg-gray-50 flex items-center gap-2">
              <ShoppingBag size={20} /> <h3 className="font-black uppercase italic tracking-tighter">Walk-in Sales</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y-2 divide-gray-100">
                {Object.entries(productSummaryNonLineman).map(([n, v]) => (
                  <tr key={n} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-black uppercase text-xs text-gray-600">{n}</td>
                    <td className="px-6 py-4 text-center font-black">x{v.qty}</td>
                    <td className="px-6 py-4 text-right font-black text-[#ac0000]">{v.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border-4 border-black rounded-[2.5rem] overflow-hidden shadow-[8px_8px_0px_rgba(16,185,129,0.3)]">
            <div className="p-6 border-b-4 border-black bg-emerald-50 flex items-center gap-2 text-emerald-900">
              <Truck size={20} /> <h3 className="font-black uppercase italic tracking-tighter">Lineman Delivery</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y-2 divide-gray-100">
                {Object.entries(productSummaryLineman).map(([n, v]) => (
                  <tr key={n} className="hover:bg-emerald-50/50">
                    <td className="px-6 py-4 font-black uppercase text-xs text-emerald-800">{n}</td>
                    <td className="px-6 py-4 text-center font-black text-emerald-900">x{v.qty}</td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600">{v.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RAW LOG */}
        <section className="bg-white border-4 border-black rounded-[2.5rem] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,1)]">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-black text-white uppercase font-black tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-5">Time</th>
                  <th className="px-6 py-5">Bill</th>
                  <th className="px-6 py-5">Items</th>
                  <th className="px-6 py-5 text-right">Total</th>
                  <th className="px-6 py-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-20 text-center font-black text-gray-300 italic text-xl uppercase tracking-tighter">No Records Loaded</td></tr>
                ) : (
                  rows.map((r, idx) => {
                    const isVoid = r.status === 'VOIDED';
                    return (
                      <tr key={idx} className={`transition-all ${isVoid ? 'opacity-20 bg-gray-100' : 'hover:bg-[#fffff0]'}`}>
                        <td className="px-6 py-4 font-bold tabular-nums text-gray-400">{r.time}</td>
                        <td className="px-6 py-4 font-black tracking-tighter text-lg italic">{r.billNo}</td>
                        <td className="px-6 py-4">
                          <div className="font-black uppercase text-[11px] text-black">{r.items}</div>
                          {r.freebies && <div className="text-[10px] text-orange-500 font-black italic uppercase tracking-tight mt-1 underline decoration-orange-200">Gift: {r.freebies}</div>}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-xl italic text-[#ac0000]">
                          {isVoid ? 'VOID' : `${Number(r.total).toLocaleString()} ฿`}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {!isVoid && (
                            <button onClick={() => handleVoid(r.billNo, r.location)} className="p-2 text-gray-300 hover:text-[#ac0000] hover:bg-red-50 rounded-full transition-all">
                              <Trash2 size={20} strokeWidth={3} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
