// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LocationPicker from './components/LocationPicker';

export default function HomePage() {
  const router = useRouter();
  const [loc, setLoc] = useState<string | null>(null);

  // โหลดค่าที่เคยเลือกไว้ (ถ้ามี)
  useEffect(() => {
    const saved = localStorage.getItem('pos_location');
    if (saved) setLoc(saved);
  }, []);

  // เลือกสถานที่ -> เซฟและเด้งไปหน้า POS
  const onPick = (id: string) => {
    setLoc(id);
    localStorage.setItem('pos_location', id); // ✅ คีย์เดียวกับ POS
    router.push('/pos');                      // ✅ นำทางไปหน้า POS
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#fffff0]">
      {/* Header คงที่ */}
      <header className="mb-6 flex items-center justify-between">
        <a href="/" className="text-2xl font-bold text-[#ac0000]">🏠 Coco Bakehouse</a>
        <div className="text-sm text-gray-700">
          Location: <b>{loc ?? '— ยังไม่ได้เลือก —'}</b>
        </div>
      </header>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* เลือกสถานที่ */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="font-semibold mb-2">เลือกสถานที่เพื่อเริ่มใช้งาน</h2>
          <LocationPicker value={loc} onChange={onPick} />
          <p className="text-sm text-gray-600">
            เมื่อเลือกแล้ว ระบบจะพาคุณไปหน้า POS อัตโนมัติ
          </p>
        </section>

        {/* ปุ่มทางลัดไปหน้าอื่น */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="font-semibold mb-3">เมนูด่วน</h2>
          <div className="flex gap-3 flex-wrap">
            <button
              className="px-4 py-2 rounded-lg border bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
              onClick={() => router.push('/pos')}
              disabled={!loc}
            >
              ไปหน้า POS
            </button>
            <button
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
              onClick={() => router.push('/history')}
            >
              ดูประวัติ (History)
            </button>
            <button
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
              onClick={() => router.push('/reports')}
            >
              รายงานสรุป (Reports)
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
