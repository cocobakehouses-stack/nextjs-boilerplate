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
  const [location, setLocation] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [rangeStart, setRangeStart] = useState<string>(toBangkokDateString());
  const [rangeEnd, setRangeEnd] = useState<string>(toBangkokDateString());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OrderRow[]>([]);

  async function load() {
    if (!location || !rangeStart || !rangeEnd) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?location=${location}&start=${rangeStart}&end=${rangeEnd}`);
      const data = await res.json();
      setRows(data?.rows || []);
    } finally {
      setLoading(false);
    }
  }

  // ---------- SUMMARY NEW ----------
  const productSummary = useMemo(() => {
    const map: Record<string, { qty: number; amount: number }> = {};
    let totalQty = 0;
    let totalAmount = 0;
    let linemanQty = 0;
    let linemanAmount = 0;

    for (const r of rows) {
      for (const i of r.items) {
        if (!map[i.name]) map[i.name] = { qty: 0, amount: 0 };
        map[i.name].qty += i.qty;
        map[i.name].amount += i.price * i.qty;
      }
      totalQty += r.items.reduce((s, i) => s + i.qty, 0);
      totalAmount += r.total;
      if (r.payment === 'lineman') {
        linemanQty += r.items.reduce((s, i) => s + i.qty, 0);
        linemanAmount += r.total;
      }
    }
    return { map, totalQty, totalAmount, linemanQty, linemanAmount };
  }, [rows]);

  // ---------- SORT BILL DESC ----------
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => Number(b.billNo) - Number(a.billNo));
  }, [rows]);

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] p-6">
      <HeaderMenu />

      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[var(--brand)]" />
          Reports
        </h1>

        {/* Controls */}
        <div className="bg-[var(--surface-muted)] rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3 border">
          <LocationPicker value={location} onChange={(id) => setLocation(id)} includeAll />
          {/* period + start + end controls */}
          <button
            onClick={load}
            className="ml-auto px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            disabled={!location || !rangeStart || !rangeEnd || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Loading…' : 'Generate'}
          </button>
        </div>

        {/* ---------- SUMMARY SECTION ---------- */}
        {rows.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <div className="bg-[var(--surface-muted)] rounded-lg p-4 space-y-2">
              <div className="font-medium">Total Products Sold:</div>
              <ul className="list-disc pl-6 text-sm">
                {Object.entries(productSummary.map).map(([name, v]) => (
                  <li key={name}>
                    {name}: {v.qty} ชิ้น = {fmt(v.amount)} บาท
                  </li>
                ))}
              </ul>
              <div className="mt-2 font-bold">
                รวมทั้งหมด: {productSummary.totalQty} ชิ้น = {fmt(productSummary.totalAmount)} บาท
              </div>
              <div className="mt-2 text-red-600 font-medium">
                Lineman: {productSummary.linemanQty} ชิ้น = {fmt(productSummary.linemanAmount)} บาท
              </div>
            </div>
          </div>
        )}

        {/* ---------- TABLE ---------- */}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr>
                  <th className="border px-2 py-1">BillNo</th>
                  <th className="border px-2 py-1">Date</th>
                  <th className="border px-2 py-1">Time</th>
                  <th className="border px-2 py-1">Location</th>
                  <th className="border px-2 py-1">Items</th>
                  <th className="border px-2 py-1">Subtotal</th>
                  <th className="border px-2 py-1">Discount</th>
                  <th className="border px-2 py-1">Markup</th>
                  <th className="border px-2 py-1">Total</th>
                  <th className="border px-2 py-1">Payment</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.billNo} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{r.billNo}</td>
                    <td className="border px-2 py-1">{r.date}</td>
                    <td className="border px-2 py-1">{r.time}</td>
                    <td className="border px-2 py-1">{r.location}</td>
                    <td className="border px-2 py-1">
                      {r.items.map((i) => `${i.name}x${i.qty}`).join(', ')}
                    </td>
                    <td className="border px-2 py-1 text-right">{fmt(r.subtotal)}</td>
                    <td className="border px-2 py-1 text-right">{fmt(r.discount)}</td>
                    <td className="border px-2 py-1 text-right">{fmt(r.linemanMarkup)}</td>
                    <td className="border px-2 py-1 text-right font-semibold">{fmt(r.total)}</td>
                    <td className="border px-2 py-1">{r.payment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
