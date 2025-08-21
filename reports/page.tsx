// app/reports/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Bucket = {
  periodKey: string;
  count: number;
  totalQty: number;
  totalAmount: number;
  freebiesAmount: number;
  byPayment: Record<string, number>;
};

type Grand = {
  count: number;
  totalQty: number;
  totalAmount: number;
  freebiesAmount: number;
  byPayment: Record<string, number>;
};

type Period = 'daily' | 'weekly' | 'monthly';

export default function ReportsPage() {
  const [location, setLocation] = useState('ORDERS');
  const [period, setPeriod] = useState<Period>('daily');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [grand, setGrand] = useState<Grand | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  const load = async () => {
    const q = new URLSearchParams({
      location,
      period,
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    }).toString();

    setLoading(true);
    try {
      const res = await fetch(`/api/reports?${q}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Load failed');
      setGrand(data.grand);
      setBuckets(data.buckets || []);
      // ถ้า user ไม่กรอกช่วง ให้แสดงช่วง default ที่ API ตอบกลับมา
      if (!start && data?.range?.start) setStart(data.range.start);
      if (!end && data?.range?.end) setEnd(data.range.end);
    } catch (e: any) {
      alert(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, period]);

  return (
    <main className="min-h-screen bg-[#fffff0] p-6">
      <h1 className="text-2xl font-bold mb-4">Sales Reports</h1>

      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-600">Location</label>
            <select className="w-full rounded border px-3 py-2 bg-white" value={location} onChange={e=>setLocation(e.target.value)}>
              <option value="ORDERS">ORDERS (รวม)</option>
              <option value="FLAGSHIP">FLAGSHIP</option>
              <option value="SINDHORN">SINDHORN</option>
              <option value="CHIN3">CHIN3</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Period</label>
            <select className="w-full rounded border px-3 py-2 bg-white" value={period} onChange={e=>setPeriod(e.target.value as Period)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Mon–Sun)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Start</label>
            <input className="w-full rounded border px-3 py-2" type="date" value={start} onChange={e=>setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">End</label>
            <input className="w-full rounded border px-3 py-2" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <button onClick={load} className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0]" disabled={loading}>
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      {/* Grand total */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <div className="bg-white rounded-xl border p-3">Bills: <b>{grand?.count ?? 0}</b></div>
        <div className="bg-white rounded-xl border p-3">Total Qty: <b>{grand?.totalQty ?? 0}</b></div>
        <div className="bg-white rounded-xl border p-3">Total Amount: <b>{(grand?.totalAmount ?? 0).toFixed(2)} THB</b></div>
        <div className="bg-white rounded-xl border p-3">Freebies Amount: <b>{(grand?.freebiesAmount ?? 0).toFixed(2)} THB</b></div>
        <div className="bg-white rounded-xl border p-3">
          By Payment:&nbsp;
          {grand && Object.keys(grand.byPayment || {}).length > 0
            ? Object.entries(grand.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
            : '—'}
        </div>
      </div>

      {/* Buckets table */}
      <div className="bg-white rounded-xl border p-4">
        {loading ? 'Loading…' : (
          buckets.length === 0 ? (
            <div className="text-gray-600">No data</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">{period === 'daily' ? 'Date' : period === 'weekly' ? 'Week (Mon start)' : 'Month'}</th>
                    <th className="py-2 pr-2">Bills</th>
                    <th className="py-2 pr-2">Total Qty</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Freebies Amount</th>
                    <th className="py-2 pr-2">By Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b) => (
                    <tr key={b.periodKey} className="border-b last:border-0">
                      <td className="py-2 pr-2">{b.periodKey}</td>
                      <td className="py-2 pr-2">{b.count}</td>
                      <td className="py-2 pr-2">{b.totalQty}</td>
                      <td className="py-2 pr-2">{b.totalAmount.toFixed(2)}</td>
                      <td className="py-2 pr-2 text-green-700">{b.freebiesAmount.toFixed(2)}</td>
                      <td className="py-2 pr-2">
                        {Object.keys(b.byPayment || {}).length === 0
                          ? '—'
                          : Object.entries(b.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </main>
  );
}