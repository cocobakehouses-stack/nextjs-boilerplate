// app/reports/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';

export default function POSPage() {
  // ... โค้ดอื่น

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#fffff0]">
      <HeaderMenu />   {/* ✅ เมนู */}
      {/* ของเดิมทั้งหมด */}
      
import LocationPicker from '../components/LocationPicker';

type Period = 'daily' | 'weekly' | 'monthly';

type Totals = {
  totalQty: number;
  totalAmount: number;
  freebiesAmount: number;
  byPayment: Record<string, number>;
  count: number;
};

type Bucket = {
  key: string; // date (daily) / week-start / month (YYYY-MM)
  totals: Totals;
};

type ReportResp = {
  location: string;
  period: Period;
  range: { start: string; end: string };
  grand: Totals;
  buckets: Bucket[];
};

type LocationRow = { id: string; label: string };

const TZ = 'Asia/Bangkok';
function toBangkokDateString(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export default function ReportsPage() {
  const [location, setLocation] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [singleReport, setSingleReport] = useState<ReportResp | null>(null);

  // สำหรับโหมด ALL
  const [allLocations, setAllLocations] = useState<LocationRow[]>([]);
  const [multiReports, setMultiReports] = useState<ReportResp[]>([]);

  // โหลดค่า default range ตาม period เมื่อเปิดหน้า/เปลี่ยน period
  useEffect(() => {
    const today = toBangkokDateString(new Date());
    if (period === 'daily') {
      setRangeStart(today);
      setRangeEnd(today);
      return;
    }
    if (period === 'weekly') {
      const d = new Date(`${today}T00:00:00+07:00`);
      const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
      const s = new Date(d);
      s.setDate(d.getDate() - dow);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      setRangeStart(toBangkokDateString(s));
      setRangeEnd(toBangkokDateString(e));
      return;
    }
    // monthly
    const [y, m] = today.split('-').map(Number);
    const startD = new Date(Date.UTC(y, (m - 1), 1));
    const endD = new Date(Date.UTC(y, m, 0));
    setRangeStart(toBangkokDateString(startD));
    setRangeEnd(toBangkokDateString(endD));
  }, [period]);

  // โหลดรายชื่อสาขาเมื่อต้องใช้ ALL
  const loadLocations = async () => {
    const res = await fetch('/api/locations', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const list: LocationRow[] = data?.locations || [];
    // กรอง value พิเศษ (เช่น ORDERS รวม) ถ้ามีในชีต — ที่นี่ต้องการ “ทุกสาขาจริง”
    const filtered = list.filter(l => l.id !== 'ORDERS');
    setAllLocations(filtered);
  };

  const fetchReport = async (loc: string): Promise<ReportResp> => {
    const q = new URLSearchParams({
      location: loc,
      period,
      start: rangeStart,
      end: rangeEnd,
    }).toString();
    const res = await fetch(`/api/reports?${q}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Load report failed');
    return data as ReportResp;
  };

  const load = async () => {
    if (!location) {
      alert('กรุณาเลือกสถานที่');
      return;
    }
    setLoading(true);
    setSingleReport(null);
    setMultiReports([]);

    try {
      if (location !== 'ALL') {
        const rep = await fetchReport(location);
        setSingleReport(rep);
      } else {
        // โหมด ALL: ดึงทุก location แล้วรวม/แสดงเป็น section
        if (allLocations.length === 0) {
          await loadLocations();
        }
        const locs = allLocations.length ? allLocations : await (async () => {
          const res = await fetch('/api/locations', { cache: 'no-store' });
          const data = await res.json().catch(() => ({}));
          const list: LocationRow[] = data?.locations || [];
          return list.filter(l => l.id !== 'ORDERS');
        })();

        const results = await Promise.all(locs.map(l => fetchReport(l.id)));
        setMultiReports(results);
      }
    } catch (e: any) {
      alert(e?.message || 'โหลดรายงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // รวม grand totals ของทุกสาขา (สำหรับ ALL)
  const allGrand: Totals | null = useMemo(() => {
    if (multiReports.length === 0) return null;
    const init: Totals = {
      count: 0, totalQty: 0, totalAmount: 0, freebiesAmount: 0, byPayment: {},
    };
    for (const r of multiReports) {
      init.count += r.grand.count;
      init.totalQty += r.grand.totalQty;
      init.totalAmount += r.grand.totalAmount;
      init.freebiesAmount += r.grand.freebiesAmount;
      for (const [k, v] of Object.entries(r.grand.byPayment || {})) {
        init.byPayment[k] = (init.byPayment[k] || 0) + v;
      }
    }
    return init;
  }, [multiReports]);

  return (
    <main className="min-h-screen p-4 sm:p-6 bg-[#fffff0]">
      <h1 className="text-2xl font-bold mb-4">Reports (Daily / Weekly / Monthly)</h1>

      {/* Controls */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap items-end gap-3">
        <LocationPicker value={location} onChange={(id) => setLocation(id)} includeAll />
        <div>
          <label className="block text-sm text-gray-600">Period</label>
          <select
            className="rounded border px-3 py-2 bg-white"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Start</label>
          <input
            type="date"
            className="rounded border px-3 py-2 bg-white"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">End</label>
          <input
            type="date"
            className="rounded border px-3 py-2 bg-white"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
          />
        </div>
        <button
          onClick={load}
          className="ml-auto px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
          disabled={!location || !rangeStart || !rangeEnd || loading}
        >
          {loading ? 'Loading…' : 'Generate'}
        </button>
      </div>

      {/* Results */}
      {!location ? (
        <div className="text-gray-600">กรุณาเลือกสถานที่ก่อน</div>
      ) : location !== 'ALL' ? (
        // ---------- โหมด Single Location ----------
        singleReport ? (
          <section className="space-y-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-700 mb-2">
                <b>Location:</b> {singleReport.location} &nbsp;|&nbsp;
                <b>Period:</b> {singleReport.period} &nbsp;|&nbsp;
                <b>Range:</b> {singleReport.range.start} → {singleReport.range.end}
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="bg-white rounded-xl border p-3">Bills: <b>{singleReport.grand.count}</b></div>
                <div className="bg-white rounded-xl border p-3">Total Qty: <b>{singleReport.grand.totalQty}</b></div>
                <div className="bg-white rounded-xl border p-3">Total Amount: <b>{singleReport.grand.totalAmount.toFixed(2)} THB</b></div>
                <div className="bg-white rounded-xl border p-3">Freebies Amount: <b>{singleReport.grand.freebiesAmount.toFixed(2)} THB</b></div>
                <div className="bg-white rounded-xl border p-3">
                  By Payment:&nbsp;
                  {Object.keys(singleReport.grand.byPayment || {}).length === 0 ? '—' :
                    Object.entries(singleReport.grand.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
                  }
                </div>
              </div>
            </div>

            {/* Buckets */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold mb-3">Breakdown by {singleReport.period}</h3>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-2">Key</th>
                      <th className="py-2 pr-2">Bills</th>
                      <th className="py-2 pr-2">Qty</th>
                      <th className="py-2 pr-2">Total</th>
                      <th className="py-2 pr-2">Freebies</th>
                      <th className="py-2 pr-2">By Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleReport.buckets.map((b) => (
                      <tr key={b.key} className="border-b last:border-0">
                        <td className="py-2 pr-2">{b.key}</td>
                        <td className="py-2 pr-2">{b.totals.count}</td>
                        <td className="py-2 pr-2">{b.totals.totalQty}</td>
                        <td className="py-2 pr-2">{b.totals.totalAmount.toFixed(2)}</td>
                        <td className="py-2 pr-2">{b.totals.freebiesAmount.toFixed(2)}</td>
                        <td className="py-2 pr-2">
                          {Object.keys(b.totals.byPayment || {}).length === 0 ? '—' :
                            Object.entries(b.totals.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
                          }
                        </td>
                      </tr>
                    ))}
                    {singleReport.buckets.length === 0 && (
                      <tr><td colSpan={6} className="py-3 text-gray-500">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : null
      ) : (
        // ---------- โหมด ALL ----------
        <>
          {/* Grand Total รวมทุกสาขา */}
          {allGrand && (
            <div className="bg-white rounded-xl border p-4 mb-4">
              <div className="text-sm text-gray-700 mb-2">
                <b>Location:</b> ALL &nbsp;|&nbsp;
                <b>Period:</b> {period} &nbsp;|&nbsp;
                <b>Range:</b> {rangeStart} → {rangeEnd}
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="bg-white rounded-xl border p-3">Bills: <b>{allGrand.count}</b></div>
                <div className="bg-white rounded-xl border p-3">Total Qty: <b>{allGrand.totalQty}</b></div>
                <div className="bg-white rounded-xl border p-3">Total Amount: <b>{allGrand.totalAmount.toFixed(2)} THB</b></div>
                <div className="bg-white rounded-xl border p-3">Freebies Amount: <b>{allGrand.freebiesAmount.toFixed(2)} THB</b></div>
                <div className="bg-white rounded-xl border p-3">
                  By Payment:&nbsp;
                  {Object.keys(allGrand.byPayment || {}).length === 0 ? '—' :
                    Object.entries(allGrand.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
                  }
                </div>
              </div>
            </div>
          )}

          {/* รายงานแยกตามสาขา */}
          {multiReports.length > 0 ? (
            <div className="space-y-6">
              {multiReports.map((rep) => (
                <section key={rep.location} className="bg-white rounded-xl border p-4">
                  <h3 className="text-lg font-semibold mb-2">{rep.location}</h3>
                  <div className="flex flex-wrap gap-3 text-sm mb-3">
                    <div className="bg-white rounded-xl border p-3">Bills: <b>{rep.grand.count}</b></div>
                    <div className="bg-white rounded-xl border p-3">Total Qty: <b>{rep.grand.totalQty}</b></div>
                    <div className="bg-white rounded-xl border p-3">Total Amount: <b>{rep.grand.totalAmount.toFixed(2)} THB</b></div>
                    <div className="bg-white rounded-xl border p-3">Freebies Amount: <b>{rep.grand.freebiesAmount.toFixed(2)} THB</b></div>
                    <div className="bg-white rounded-xl border p-3">
                      By Payment:&nbsp;
                      {Object.keys(rep.grand.byPayment || {}).length === 0 ? '—' :
                        Object.entries(rep.grand.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
                      }
                    </div>
                  </div>

                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-2">Key</th>
                          <th className="py-2 pr-2">Bills</th>
                          <th className="py-2 pr-2">Qty</th>
                          <th className="py-2 pr-2">Total</th>
                          <th className="py-2 pr-2">Freebies</th>
                          <th className="py-2 pr-2">By Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rep.buckets.map((b) => (
                          <tr key={`${rep.location}-${b.key}`} className="border-b last:border-0">
                            <td className="py-2 pr-2">{b.key}</td>
                            <td className="py-2 pr-2">{b.totals.count}</td>
                            <td className="py-2 pr-2">{b.totals.totalQty}</td>
                            <td className="py-2 pr-2">{b.totals.totalAmount.toFixed(2)}</td>
                            <td className="py-2 pr-2">{b.totals.freebiesAmount.toFixed(2)}</td>
                            <td className="py-2 pr-2">
                              {Object.keys(b.totals.byPayment || {}).length === 0 ? '—' :
                                Object.entries(b.totals.byPayment).map(([k,v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ')
                              }
                            </td>
                          </tr>
                        ))}
                        {rep.buckets.length === 0 && (
                          <tr><td colSpan={6} className="py-3 text-gray-500">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          ) : loading ? (
            <div className="text-gray-600">Loading…</div>
          ) : (
            <div className="text-gray-600">ไม่มีข้อมูล</div>
          )}
        </>
      )}
    </main>
  );
}
