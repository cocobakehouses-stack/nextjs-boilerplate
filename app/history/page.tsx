'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { Trash2, Download, Calendar, MapPin, Gift, TrendingUp, Truck, ShoppingBag } from 'lucide-react';

/* ========== Types ========== */
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

// Fixed parser for your semicolon-delimited string format
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

  // 1. Fetch Products for Price Reference
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/products?activeOnly=0');
        const data = await res.json();
        setProducts(Array.isArray(data?.products) ? data.products : []);
      } catch { setProducts([]); }
    })();
  }, []);

  const priceByName = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.name.trim()] = Number(p.price) || 0;
    return m;
  }, [products]);

  // 2. Fetch Locations
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/locations');
        const data = await res.json();
        const list: LocationRow[] = data?.locations || [];
        setLocations([{ id: ALL_ID, label: 'All Locations' }, ...list]);
        const saved = (localStorage.getItem('pos_location') || ALL_ID).toUpperCase();
        setLocation(list.some(l => l.id === saved) ? saved : ALL_ID);
      } catch { setLocations([{ id: ALL_ID, label: 'All Locations' }]); }
    };
    load();
  }, []);

  // 3. Main Data Fetch
  async function fetchHistory() {
    setLoading(true);
    try {
      const url = new URL('/api/history', window.location.origin);
      url.searchParams.set('location', location);
      url.searchParams.set('date', date);
      const res = await fetch(url.toString());
      const data = await res.json();
      const list: HistoryRow[] = data?.rows || [];
      setRows([...list].sort((a, b) => Number(b.billNo) - Number(a.billNo)));
    } finally { setLoading(false); }
  }

  // Reload when filters change
  useEffect(() => { fetchHistory(); }, [location, date]);

const activeRows = useMemo(() => {
  return rows.filter(r => r.status !== 'VOIDED');
}, [rows]);
  
  // 4. Summarization Logic
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
    }, [activeRows]);

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

  // 5. Void Logic
  async function handleVoid(billNo: string, rowLoc: string | undefined) {
    const targetLoc = rowLoc || location;
    if (targetLoc === ALL_ID) return alert("Select a specific location to void.");
    if (!confirm(`VOID BILL #${billNo}? This cannot be undone.`)) return;

    try {
      const res = await fetch('/api/history/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billNo, location: targetLoc }),
      });
      if (res.ok) { fetchHistory(); }
    } catch (err) { alert("Failed to void bill."); }
  }

  const csvHref = `/api/history/csv?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`;

  return (
    <main className="min-h-screen bg-[#fffff0] pb-20">
      <div className="sticky top-0 z-50 bg-white border-b-4 border-black">
        <div className="max-w-6xl mx-auto px-4 py-4"><HeaderMenu /></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-black">End of Day</h1>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">Coco Bakehouse Management</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Location</label>
              <select value={location} onChange={e => setLocation(e.target.value)} className="block w-full rounded-xl border-2 border-black p-2 font-bold text-sm">
                {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="block w-full rounded-xl border-2 border-black p-2 font-bold text-sm" />
            </div>
            <a href={csvHref} download className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded-xl font-black uppercase text-xs self-end mb-[2px]">
              <Download size={14} /> Export CSV
            </a>
          </div>
        </header>

        {/* METRICS GRID */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border-4 border-black p-6 rounded-[2rem] shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Bills</p>
            <p className="text-3xl font-black">{computedTotals.count}</p>
          </div>
          <div className="bg-white border-4 border-black p-6 rounded-[2rem] shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sold</p>
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

        {/* FREEBIE DETAILED BREAKDOWN */}
        {Object.keys(freebieSummary).length > 0 && (
          <section className="bg-orange-50 border-4 border-orange-200 rounded-[2rem] p-6">
            <div className="flex items-center gap-2 mb-6">
              <Gift className="text-orange-600" />
              <h2 className="text-xl font-black uppercase italic tracking-tight text-orange-900">Marketing Freebie Summary</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(freebieSummary).map(([name, data]) => (
                <div key={name} className="bg-white p-4 rounded-2xl border-2 border-orange-100 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-black text-xs uppercase text-gray-800">{name}</p>
                    <p className="text-[10px] font-bold text-gray-400">COST: {data.amount.toLocaleString()} ฿</p>
                  </div>
                  <p className="text-2xl font-black text-orange-600">x{data.qty}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SALES TABLES */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white border-4 border-black rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b-4 border-black bg-gray-50 flex items-center gap-2">
              <ShoppingBag size={20} /> <h3 className="font-black uppercase italic">Walk-in Sales</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y-2 divide-gray-100">
                {Object.entries(productSummaryNonLineman).map(([n, v]) => (
                  <tr key={n} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-black uppercase text-xs">{n}</td>
                    <td className="px-6 py-4 text-center font-bold">x{v.qty}</td>
                    <td className="px-6 py-4 text-right font-black text-[#ac0000]">{v.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border-4 border-black rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b-4 border-black bg-emerald-50 flex items-center gap-2">
              <Truck size={20} className="text-emerald-600" /> <h3 className="font-black uppercase italic text-emerald-900">Lineman Delivery</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y-2 divide-gray-100">
                {Object.entries(productSummaryLineman).map(([n, v]) => (
                  <tr key={n} className="hover:bg-emerald-50/50">
                    <td className="px-6 py-4 font-black uppercase text-xs text-emerald-900">{n}</td>
                    <td className="px-6 py-4 text-center font-bold">x{v.qty}</td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600">{v.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RAW BILL LOG */}
        <section className="bg-white border-4 border-black rounded-[2rem] overflow-hidden shadow-[8px_8px_0px_rgba(0,0,0,1)]">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-black text-white uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Bill</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-100">
                {rows.map((r, idx) => {
                  const isVoid = r.status === 'VOIDED';
                  return (
                    <tr key={idx} className={`${isVoid ? 'opacity-30 bg-gray-50' : 'hover:bg-[#fffff0]'}`}>
                      <td className="px-6 py-4 font-bold">{r.time}</td>
                      <td className="px-6 py-4 font-black">{r.billNo}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold">{r.items}</div>
                        {r.freebies && <div className="text-[10px] text-orange-500 font-black italic uppercase">GIFT: {r.freebies}</div>}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-lg">
                        {isVoid ? 'VOID' : `${Number(r.total).toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {!isVoid && (
                          <button onClick={() => handleVoid(r.billNo, r.location)} className="text-gray-300 hover:text-[#ac0000] transition-colors">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
