'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import HeaderMenu from '../components/HeaderMenu';
import LocationPicker from '../components/LocationPicker';

// ... (type definitions ของ Period, Totals, Bucket, ReportResp, LocationRow คงเดิม)

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
  // ... (state และ useEffect เดิมทั้งหมด)

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
          {/* ...เหมือนโค้ดเดิม */}
          <button
            onClick={load}
            className="ml-auto px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            disabled={!location || !rangeStart || !rangeEnd || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Loading…' : 'Generate'}
          </button>
        </div>

        {/* Results */}
        {/* …ใช้ logic เดิม แต่ครอบด้วย bg-white rounded-xl shadow p-4 + table hover:bg-gray-50 */}
      </div>
    </main>
  );
}
