// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { locations, type LocationId } from './data/locations';

export default function Home() {
  const router = useRouter();
  const [selected, setSelected] = useState<LocationId | null>(null);

  useEffect(() => {
    const saved = (localStorage.getItem('pos_location') as LocationId | null) || null;
    if (saved) setSelected(saved);
  }, []);

  const choose = (loc: LocationId) => {
    localStorage.setItem('pos_location', loc);
    setSelected(loc);
    router.push('/pos'); // ไปหน้า POS ทันที
  };

  return (
    <main className="min-h-screen bg-[#fffff0] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Coco Bakehouse POS</h1>
        <p className="text-gray-700 mb-6">เลือกสาขาก่อนเริ่มทำรายการ</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {locations.map((l) => (
            <button
              key={l.id}
              onClick={() => choose(l.id)}
              className={`rounded-xl p-5 text-center border bg-white hover:opacity-90 ${
                selected === l.id ? 'border-[#ac0000]' : ''
              }`}
            >
              <div className="text-lg font-semibold">{l.label}</div>
              <div className="text-xs text-gray-500 mt-1">{l.id}</div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm">
              สาขาปัจจุบัน: <b>{selected}</b>
            </span>
            <button
              className="px-3 py-1 rounded-lg border bg-white"
              onClick={() => router.push('/pos')}
            >
              เข้า POS
            </button>
            <button
              className="px-3 py-1 rounded-lg border bg-white"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                router.push(`/history?location=${encodeURIComponent(selected)}&date=${today}`);
              }}
            >
              ดูประวัติวันนี้
            </button>
            <button
              className="px-3 py-1 rounded-lg border bg-white"
              onClick={() => {
                localStorage.removeItem('pos_location');
                setSelected(null);
              }}
            >
              เปลี่ยนสาขา
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
