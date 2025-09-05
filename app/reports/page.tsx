'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import HeaderMenu from '../components/HeaderMenu';
import LocationPicker from '../components/LocationPicker';

type Period = 'daily' | 'weekly' | 'monthly' | 'range';

type Line = { name: string; qty: number; price: number };
type OrderRow = {
  date: string;
  time: string;
  billNo: string;
  location: string;
  items: Line[];
  freebies: Line[];
  subtotal: number;
  discount: number;
  linemanMarkup: number;
  linemanDiscount: number;
  total: number;
  payment: 'cash' | 'promptpay' | 'lineman';
};

const TZ = 'Asia/Bangkok';
function toBangkokDateString(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
function fmt(n: number, digits = 2) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function ReportsPage() {
  const [locId, setLocId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [rangeStart, setRangeStart] = useState<string>(toBangkokDateString());
  const [rangeEnd, setRangeEnd] = useState<string>(toBangkokDateString());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OrderRow[]>([]);

  async function load() {
    if (!locId || !rangeStart || !rangeEnd) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        location: locId,
        start: rangeStart,
        end: rangeEnd,
      }).toString();
      const res = await fetch(`/api/reports?${q}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } finally {
      setLoading(false);
    }
  }

  // ===== GRAND SUMMARY =====
  const grand = useMemo(() => {
    if (rows.length === 0) {
      return { count: 0, totalQty: 0, totalAmount: 0, freebiesAmount: 0, byPayment: {} as Record<string, number> };
    }
    let count = rows.length;
    let totalQty = 0;
    let totalAmount = 0;
    let freebiesAmount = 0;
    const byPayment: Record<string, number> = {};
    for (const r of rows) {
      const qty = r.items.reduce((s, i) => s + (i.qty || 0), 0);
      const freeAmt = (r.freebies || []).reduce(
        (s, f) => s + (Number(f.qty) || 0) * (Number(f.price) || 0),
        0
      );
      totalQty += qty;
      totalAmount += Number(r.total || 0);
      freebiesAmount += freeAmt;
      const key = r.payment || '-';
      byPayment[key] = (byPayment[key] || 0) + Number(r.total || 0);
    }
    return { count, totalQty, totalAmount, freebiesAmount, byPayment };
  }, [rows]);

  // ===== PRODUCT SUMMARY + LINEMAN SPLIT =====
  const { productMap, totalQtyAll, totalAmountAll, linemanQty, linemanAmount } = useMemo(() => {
    const map: Record<string, { qty: number; amount: number }> = {};
    let totalQty = 0;
    let totalAmount = 0;
    let lmQty = 0;
    let lmAmount = 0;
    for (const r of rows) {
      const billQty = r.items.reduce((s, i) => s + (i.qty || 0), 0);
      for (const i of r.items) {
        if (!map[i.name]) map[i.name] = { qty: 0, amount: 0 };
        map[i.name].qty += i.qty || 0;
        map[i.name].amount += (i.price || 0) * (i.qty || 0);
      }
      totalQty += billQty;
      totalAmount += Number(r.total || 0);
      if (r.payment === 'lineman') {
        lmQty += billQty;
        lmAmount += Number(r.total || 0);
      }
    }
    return { productMap: map, totalQtyAll: totalQty, totalAmountAll: totalAmount, linemanQty: lmQty, linemanAmount: lmAmount };
  }, [rows]);

  // ===== SORT BILL DESC =====
  const sortedRows = useMemo(() => [...rows].sort((a, b) => Number(b.billNo) - Number(a.billNo)), [rows]);

  // ===== EXPORT CSV =====
  const { csvHref, filenameCSV } = useMemo(() => {
    if (!locId || !rangeStart || !rangeEnd) {
      return { csvHref: '#', filenameCSV: '' };
    }
    const qs = new URLSearchParams({ location: String(locId), start: rangeStart, end: rangeEnd });
    const csv = `/api/reports/csv?${qs.toString()}`;
    const fnBase = `reports_${locId}_${rangeStart}_${rangeEnd}`;
    return { csvHref: csv, filenameCSV: `${fnBase}.csv` };
  }, [locId, rangeStart, rangeEnd]);

  return (
    <main className="min-h-screen bg-[var(--surface-muted)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <HeaderMenu />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[var(--brand)]" />
          Reports
        </h1>

        {/* Controls */}
        <div className="bg-[var(--surface-muted)] rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3 border">
          <LocationPicker value={locId} onChange={(id) => setLocId(id)} includeAll />

          <div>
            <label className="block text-sm text-gray-600 mb-1">Period</label>
            <select
              className="rounded border px-3 py-2 bg-white"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="range">Custom Range</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Start</label>
            <input type="date" className="rounded border px-3 py-2 bg-white" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">End</label>
            <input type="date" className="rounded border px-3 py-2 bg-white" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
              disabled={!locId || !rangeStart || !rangeEnd || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Loading…' : 'Generate'}
            </button>

            <a
              href={csvHref}
              download={filenameCSV}
              onClick={(e) => { if (csvHref === '#') e.preventDefault(); }}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
              aria-disabled={!locId || !rangeStart || !rangeEnd}
            >
              Export CSV
            </a>
          </div>
        </div>

        {/* Summary */}
        {rows.length > 0 && !loading && (
          <div className="rounded-xl border bg-white p-4 mb-6 space-y-6">
            <section>
              <h2 className="font-semibold mb-2">Summary</h2>
              <div>Bills: {grand.count} | Total Qty: {grand.totalQty}</div>
              <div>Total Amount: {fmt(grand.totalAmount)} THB</div>
              <div>Freebies Amount: {fmt(grand.freebiesAmount)} THB</div>
              {Object.keys(grand.byPayment).length > 0 && (
                <div className="text-gray-700">
                  By Payment:{' '}
                  {Object.entries(grand.byPayment).map(([k, v]) => `${k}: ${fmt(v)} THB`).join(' | ')}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">Products Sold (All)</h3>
              <div className="bg-[var(--surface-muted)] rounded-lg p-3">
                <ul className="list-disc pl-6 text-sm">
                  {Object.entries(productMap).map(([name, v]) => (
                    <li key={name}>{name}: {v.qty} ชิ้น = {fmt(v.amount)} บาท</li>
                  ))}
                </ul>
                <div className="mt-2 font-semibold">
                  รวมทั้งหมด: {totalQtyAll} ชิ้น = {fmt(totalAmountAll)} บาท
                </div>
              </div>

              <div className="p-3 border rounded bg-gray-50">
                <div className="font-semibold">🚚 Lineman (separate)</div>
                <div>Total Qty: {linemanQty}</div>
                <div>Total Amount: {fmt(linemanAmount)} THB</div>
              </div>
            </section>
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && !loading && (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)] border-b">
                <tr className="[&>th]:px-2 [&>th]:py-2 text-left">
                  <th>BillNo</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Items</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Markup</th>
                  <th className="text-right">Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={`${r.location}-${r.billNo}-${r.time}`} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-2">{r.billNo}</td>
                    <td className="px-2 py-2">{r.date}</td>
                    <td className="px-2 py-2">{r.time}</td>
                    <td className="px-2 py-2">{r.location}</td>
                    <td className="px-2 py-2">{r.items.map((i) => `${i.name}x${i.qty}`).join(', ')}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.subtotal)}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.discount ?? 0)}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.linemanMarkup ?? 0)}</td>
                    <td className="px-2 py-2 text-right font-semibold">{fmt(r.total)}</td>
                    <td className="px-2 py-2">{r.payment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length === 0 && !loading && (
          <div className="text-gray-600">No data. เลือก location / วันที่ แล้วกด Generate ค่ะ</div>
        )}
      </div>
    </main>
  );
}
