// app/history/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

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
      try {
        const res = await fetch('/api/locations', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        setLocations([{ id: ALL_ID, label: 'All Locations' }, ...(data?.locations || [])]);

        const saved = (localStorage.getItem('pos_location') || ALL_ID).toUpperCase();
        setLocation(saved);
      } catch {
        setLocations([{ id: ALL_ID, label: 'All Locations' }]);
        setLocation(ALL_ID);
      }
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
    try {
      const url = new URL('/api/history', window.location.origin);
      url.searchParams.set('location', location);
      url.searchParams.set('date', date);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json();

      const list: HistoryRow[] = data?.rows || [];
      const sorted = list.sort((a, b) => Number(b.billNo) - Number(a.billNo)); // มาก→น้อย
      setRows(sorted);
      setTotals(data?.totals || reduceTotals(sorted));
    } finally {
      setLoading(false);
    }
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
          sum[name].qty += qty;
          sum[name].amount += total; // approx.
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
    <>
      <h1 className="text-2xl font-bold mb-4">End of Day – History</h1>

      {/* Controls */}
      <div className="rounded-xl border bg-white p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">สถานที่</label>
          <select
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="rounded border px-3 py-2 w-full bg-white"
          >
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.label}{l.id !== ALL_ID ? ` (${l.id})` : ''}</option>
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

          {/* Export CSV (ลิงก์สร้างตรงจาก state) */}
          <a
            href={
              !location || !date
                ? '#'
                : `/api/history/csv?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`
            }
            onClick={(e) => { if (!location || !date) e.preventDefault(); }}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
            aria-disabled={!location || !date}
          >
            Export CSV
          </a>
        </div>
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
              By Payment:{' '}
              {Object.entries(totals.byPayment)
                .map(([k, v]) => `${k}: ${v.toFixed(2)} THB`)
                .join(' | ')}
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr><th className="text-left p-2">Product</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Amount</th></tr>
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
                    <tr><th className="text-left p-2">Product</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Amount</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(productSummaryLineman).map(([n, v]) => (
                      <tr key={n} className="border-t">
                        <td className="p-2">{n}</td>
                        <td className="p-2 text-right">{v.qty}</td>
                        <td className="p-2 text-right">{v.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
                    <td>{(r.total ?? 0).toFixed(2)}</td>
                    <td className="max-w-[320px] whitespace-pre-wrap break-words">{r.freebies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Duplicate export ปลายตาราง (เผื่อหน้า list ยาว) */}
        {rows.length > 0 && (
          <div className="mt-4">
            <a
              href={
                !location || !date
                  ? '#'
                  : `/api/history/csv?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`
              }
              onClick={(e) => { if (!location || !date) e.preventDefault(); }}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40 inline-block"
              aria-disabled={!location || !date}
            >
              Export CSV
            </a>
          </div>
        )}
      </div>
    </>
  );
}
