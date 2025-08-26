'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import LocationPicker from '../components/LocationPicker';

// ---------- Types ----------
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

// ---------- Utils ----------
const TZ = 'Asia/Bangkok';
function toBangkokDateString(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

// ---------- Component ----------
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

  // โหลดค่า default range ตาม period
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
    setAllLocations(list.filter(l => l.id !== 'ORDERS'));
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
        if (allLocations.length === 0) {
          await loadLocations();
        }
      const locs: LocationRow[] = allLocations.length
  ? allLocations
  : await (async (): Promise<LocationRow[]> => {
      const res = await fetch('/api/locations', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: LocationRow[] = data?.locations || [];
      return list.filter((l: LocationRow) => l.id !== 'ORDERS');
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

  // รวม grand totals ของทุกสาขา (ALL)
  const allGrand: Totals | null = useMemo(() => {
    if (multiReports.length === 0) return null;
    const init: Totals = {
      count: 0,
      totalQty: 0,
      totalAmount: 0,
      freebiesAmount: 0,
      byPayment: {},
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
      <HeaderMenu />

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
      {/* ... (เหมือนที่หมวยเขียนอยู่แล้ว ไม่ต้องแก้) ... */}
    </main>
  );
}
