// app/history/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';

type LocationRow = { id: string; label: string };
type HistoryRow = {
  date: string; time: string; billNo: string;
  items: string; freebies: string;
  totalQty: number; payment: string;
  total: number; freebiesAmount: number; location?: string;
};

const TZ = 'Asia/Bangkok';
const ALL_ID = 'ALL';
function toBangkokDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

export default function HistoryPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [location, setLocation] = useState<string>(ALL_ID);
  const [date, setDate] = useState<string>(toBangkokDateString());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // โหลด locations
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/locations', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setLocations([{ id: ALL_ID, label: 'All Locations' }, ...(data?.locations || [])]);
      setLocation((localStorage.getItem('pos_location') || ALL_ID).toUpperCase());
    };
    load();
  }, []);

  // รวมยอด
  function reduceTotals(all: HistoryRow[]) {
    const count = all.length;
    const totalQty = all.reduce((s, r) => s + (r.totalQty || 0), 0);
    const totalAmount = all.reduce((s, r) => s + (r.total || 0), 0);
    const freebiesAmount = all.reduce((s, r) => s + (r.freebiesAmount || 0), 0);
    const byPayment: Record<string, number> = {};
    for (const r of all) byPayment[r.payment] = (byPayment[r.payment] || 0) + r.total;
    return { count, totalQty, totalAmount, freebiesAmount, byPayment };
  }

  // โหลดข้อมูล
  async function fetchHistory() {
    setLoading(true);
    const url = new URL('/api/history', window.location.origin);
    url.searchParams.set('location', location);
    url.searchParams.set('date', date);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json();
    const list: HistoryRow[] = data?.rows || [];
    const sorted = list.sort((a, b) => Number(b.billNo) - Number(a.billNo));
    setRows(sorted);
    setTotals(data?.totals || reduceTotals(sorted));
    setLoading(false);
  }

  // แยก Lineman summary
  const linemanSummary = useMemo(() => {
    const rowsLm = rows.filter(r => r.payment?.toLowerCase() === 'lineman');
    return rowsLm.length ? reduceTotals(rowsLm) : null;
  }, [rows]);

  // แยกสรุปสินค้าตาม payment
  const { productSummaryNonLineman, productSummaryLineman } = useMemo(() => {
    const nonL: Record<string, { qty: number; amount: number }> = {};
    const lm: Record<string, { qty: number; amount: number }> = {};
    const add = (sum: typeof nonL, items: string, total: number) => {
      items.split(';').forEach(it => {
        const m = it.trim().match(/(.+?) x(\d+)/);
        if (m) {
          const name = m[1].trim(); const qty = Number(m[2]);
          if (!sum[name]) sum[name] = { qty: 0, amount: 0 };
          sum[name].qty += qty; sum[name].amount += total; // approx.
        }
      });
    };
    rows.forEach(r => {
      if (r.payment?.toLowerCase() === 'lineman') add(lm, r.items, r.total);
      else add(nonL, r.items, r.total);
    });
    return { productSummaryNonLineman: nonL, productSummaryLineman: lm };
  }, [rows]);

  return (
    <main className="min-h-screen bg-[#fffff0] p-6">
      <HeaderMenu />
      <h1 className="text-2xl font-bold mb-4">End of Day – History</h1>

      {/* Controls */}
      <div className="rounded-xl border bg-white p-4 mb-6 flex gap-3">
        <select value={location} onChange={e => setLocation(e.target.value)}
          className="rounded border px-3 py-2">
          {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded border px-3 py-2" />
        <button onClick={fetchHistory}
          className="px-4 py-2 rounded bg-[#ac0000] text-[#fffff0]">ดูข้อมูล</button>
      </div>

      {/* SUMMARY */}
      {totals && (
        <div className="rounded-xl border bg-white p-4 mb-6 space-y-4">
          <div>
            <div className="font-semibold mb-2">Summary</div>
            <div>Bills: {totals.count} | Qty: {totals.totalQty}</div>
            <div>Total: {totals.totalAmount.toFixed(2)} THB</div>
            <div>Freebies: {totals.freebiesAmount.toFixed(2)} THB</div>
            <div className="text-gray-700">
              By Payment: {Object.entries(totals.byPayment).map(([k,v])=>`${k}: ${v.toFixed(2)} THB`).join(' | ')}
            </div>
          </div>

          {linemanSummary && (
            <div className="p-3 border rounded bg-gray-50">
              <div className="font-semibold">🚚 Lineman Summary</div>
              <div>Bills: {linemanSummary.count} | Qty: {linemanSummary.totalQty}</div>
              <div>Total: {linemanSummary.totalAmount.toFixed(2)} THB</div>
            </div>
          )}

          {/* Product Summary Non-Lineman */}
          <div>
            <div className="font-semibold mb-2">🛒 Product Sales (Non-Lineman)</div>
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-100"><tr><th>Product</th><th>Qty</th><th>Amount</th></tr></thead>
              <tbody>
                {Object.entries(productSummaryNonLineman).map(([n,v])=>(
                  <tr key={n}><td>{n}</td><td>{v.qty}</td><td>{v.amount.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Product Summary Lineman */}
          {Object.keys(productSummaryLineman).length>0 && (
            <div>
              <div className="font-semibold mb-2">📦 Product Sales (Lineman)</div>
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100"><tr><th>Product</th><th>Qty</th><th>Amount</th></tr></thead>
                <tbody>
                  {Object.entries(productSummaryLineman).map(([n,v])=>(
                    <tr key={n}><td>{n}</td><td>{v.qty}</td><td>{v.amount.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="rounded-xl border bg-white p-4">
        {rows.length===0? <div>{loading?'กำลังโหลด…':'ไม่มีข้อมูล'}</div> : (
          <table className="min-w-full text-sm">
            <thead className="border-b"><tr>
              {location===ALL_ID && <th>Location</th>}
              <th>Time</th><th>Bill</th><th>Items</th><th>Qty</th>
              <th>Payment</th><th>Total</th><th>Freebies</th>
            </tr></thead>
            <tbody>
              {rows.map((r,idx)=>(
                <tr key={idx} className="border-b">
                  {location===ALL_ID && <td>{r.location}</td>}
                  <td>{r.time}</td><td>{r.billNo}</td>
                  <td>{r.items}</td><td>{r.totalQty}</td>
                  <td>{r.payment}</td><td>{r.total.toFixed(2)}</td>
                  <td>{r.freebies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
