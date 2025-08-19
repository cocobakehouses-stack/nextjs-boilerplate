// app/history/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type Row = {
  date: string; time: string; billNo: string; items: string;
  freebies: string; totalQty: number; payment: string; total: number;
};

function Inner() {
  const sp = useSearchParams();
  const [location, setLocation] = useState(sp.get('location') || 'FLAGSHIP');
  const [date, setDate] = useState(sp.get('date') || new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{count:number; totalQty:number; totalAmount:number; byPayment: Record<string, number>}>({count:0,totalQty:0,totalAmount:0,byPayment:{}});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const q = new URLSearchParams({ location, date }).toString();
    const res = await fetch(`/api/history?${q}`, { cache: 'no-store' });
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows || []);
      setTotals(data.totals || {count:0,totalQty:0,totalAmount:0,byPayment:{}});
    } else {
      alert(data.error || 'Load failed');
    }
    setLoading(false);
  };

  useEffect(() => {
    const q = new URLSearchParams({ location, date }).toString();
    const url = `/history?${q}`;
    window.history.replaceState(null, '', url);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, date]);

  return (
    <main className="min-h-screen p-4 sm:p-6 bg-[#fffff0]">
      <h1 className="text-2xl font-bold mb-4">End of Day – History</h1>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-sm text-gray-600">Location</label>
          <select value={location} onChange={e => setLocation(e.target.value)} className="rounded border px-3 py-2 bg-white">
            <option value="FLAGSHIP">หน้าร้าน</option>
            <option value="SINDHORN">สินธร</option>
            <option value="CHIN3">ชินวัตร 3</option>
            <option value="ORDERS">ORDERS (รวม)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded border px-3 py-2 bg-white" />
        </div>
        <div className="ml-auto flex gap-2">
          <a
            className="px-4 py-2 rounded-lg border bg-white"
            href={`/api/history/csv?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`}
            target="_blank" rel="noreferrer"
          >
            Download CSV
          </a>
          <a
            className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0]"
            href={`/api/history/pdf?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`}
            target="_blank" rel="noreferrer"
          >
            Download PDF
          </a>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        {loading ? <div>Loading…</div> : rows.length === 0 ? (
          <div className="text-gray-600">No data</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Bill</th>
                  <th className="py-2 pr-2">Items</th>
                  <th className="py-2 pr-2">Freebies</th>
                  <th className="py-2 pr-2">Qty</th>
                  <th className="py-2 pr-2">Payment</th>
                  <th className="py-2 pr-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2 pr-2">{r.time}</td>
                    <td className="py-2 pr-2">{r.billNo}</td>
                    <td className="py-2 pr-2 whitespace-pre-wrap">{r.items}</td>
                    <td className="py-2 pr-2 whitespace-pre-wrap text-green-700">{r.freebies}</td>
                    <td className="py-2 pr-2">{r.totalQty}</td>
                    <td className="py-2 pr-2">{r.payment}</td>
                    <td className="py-2 pr-2">{r.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="bg-white rounded-xl border p-3">Bills: <b>{totals.count}</b></div>
        <div className="bg-white rounded-xl border p-3">Total Qty: <b>{totals.totalQty}</b></div>
        <div className="bg-white rounded-xl border p-3">Total Amount: <b>{totals.totalAmount.toFixed(2)} THB</b></div>
        <div className="bg-white rounded-xl border p-3">Freebies Amount: <b>{(totals.freebiesAmount || 0).toFixed(2)} THB</b></div>
        <div className="bg-white rounded-xl border p-3">
          By Payment:&nbsp;
          {Object.keys(totals.byPayment).length === 0 ? '—' :
            Object.entries(totals.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
          }
        </div>
      </div>
    </main>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-6">Loading…</main>}>
      <Inner />
    </Suspense>
  );
}
