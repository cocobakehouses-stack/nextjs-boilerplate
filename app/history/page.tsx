// app/history/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';

type LocationRow = { id: string; label: string };
type HistoryRow = {
  date: string;
  time: string;
  billNo: string;
  items: string;
  freebies: string;
  totalQty: number;
  payment: string;
  total: number;
  freebiesAmount: number;
  location?: string;
};

const TZ = 'Asia/Bangkok';
function toBangkokDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
const ALL_ID = 'ALL';

export default function HistoryPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(true);
  const [location, setLocation] = useState<string>('');
  const [date, setDate] = useState<string>(toBangkokDateString());

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [totals, setTotals] = useState<{
    count: number;
    totalQty: number;
    totalAmount: number;
    freebiesAmount: number;
    byPayment: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // โหลดรายการสถานที่จาก /api/locations + แทรก All
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingLocs(true);
        const res = await fetch('/api/locations', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const list: LocationRow[] = data?.locations || [];
        const final = [{ id: ALL_ID, label: 'All Locations' }, ...list];
        setLocations(final);

        const saved = (localStorage.getItem('pos_location') || '').toUpperCase();
        if (saved && final.some(l => l.id === saved)) setLocation(saved);
        else setLocation(ALL_ID);
      } finally {
        setLoadingLocs(false);
      }
    };
    load();
  }, []);

  // รวมยอดข้ามหลายสาขา (fallback เผื่อ backend ไม่รวมให้)
  function reduceTotals(all: HistoryRow[]) {
    const count = all.length;
    const totalQty = all.reduce((s, r) => s + (r.totalQty || 0), 0);
    const totalAmount = all.reduce((s, r) => s + (r.total || 0), 0);
    const freebiesAmount = all.reduce((s, r) => s + (r.freebiesAmount || 0), 0);
    const byPayment: Record<string, number> = {};
    for (const r of all) {
      const k = r.payment || '-';
      byPayment[k] = (byPayment[k] || 0) + (r.total || 0);
    }
    return { count, totalQty, totalAmount, freebiesAmount, byPayment };
  }

  // โหลดข้อมูล (สาขาเดียว / All)
  const fetchHistory = async () => {
    try {
      setLoading(true);
      setRows([]);
      setTotals(null);

      const url = new URL('/api/history', window.location.origin);
      url.searchParams.set('location', location);
      url.searchParams.set('date', date);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json();

      const list: HistoryRow[] = (data?.rows || []);
      const withLoc = list.map(r => (r.location ? r : { ...r, location: location === ALL_ID ? '' : location }));

      setRows(withLoc);
      setTotals(data?.totals || reduceTotals(withLoc));
    } catch (e) {
      console.error('load history error', e);
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  // ลิงก์ดาวน์โหลด
  const csvHref = useMemo(() => {
    if (!location || !date) return '#';
    const u = new URL('/api/history/csv', window.location.origin);
    u.searchParams.set('location', location);
    u.searchParams.set('date', date);
    return u.toString();
  }, [location, date]);

  const pdfHref = useMemo(() => {
    if (!location || !date) return '#';
    const u = new URL('/api/history/pdf', window.location.origin);
    u.searchParams.set('location', location);
    u.searchParams.set('date', date);
    return u.toString();
  }, [location, date]);

  return (
    <main className="min-h-screen bg-[#fffff0] p-4 sm:p-6 lg:p-8">
      <HeaderMenu />
      <h1 className="text-2xl font-bold mb-4">End of Day – History</h1>

      <div className="rounded-xl border bg-white p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">สถานที่</label>
          <select
            className="rounded border px-3 py-2 bg-white w-full"
            value={location}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setLocation(v);
              if (v !== ALL_ID) localStorage.setItem('pos_location', v);
            }}
            disabled={loadingLocs}
          >
            {loadingLocs ? (
              <option>Loading locations…</option>
            ) : locations.length === 0 ? (
              <option>— ไม่มีสถานที่ —</option>
            ) : (
              locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.label} {l.id !== ALL_ID ? `(${l.id})` : ''}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">วันที่</label>
          <input
            type="date"
            className="rounded border px-3 py-2 bg-white"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] disabled:opacity-40"
            onClick={fetchHistory}
            disabled={!location || !date || loading}
          >
            {loading ? 'กำลังกำลังโหลด…' : 'ดูข้อมูล'}
          </button>

          <a
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            href={csvHref}
            onClick={(e) => { if (csvHref === '#') e.preventDefault(); }}
          >
            ดาวน์โหลด CSV
          </a>
          <a
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            href={pdfHref}
            onClick={(e) => { if (pdfHref === '#') e.preventDefault(); }}
          >
            ดาวน์โหลด PDF
          </a>
        </div>
      </div>

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

        {totals && (
          <div className="mt-4 text-sm">
            <div className="font-semibold">Summary</div>
            <div>Bills: {totals.count} | Total Qty: {totals.totalQty}</div>
            <div>Total Amount: {totals.totalAmount.toFixed(2)} THB</div>
            <div>Freebies Amount: {totals.freebiesAmount.toFixed(2)} THB</div>
            {totals.byPayment && (
              <div className="text-gray-700">
                By Payment:{' '}
                {Object.entries(totals.byPayment)
                  .map(([k, v]) => `${k}: ${v.toFixed(2)} THB`)
                  .join(' | ')}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
