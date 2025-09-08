// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HeaderMenu from './components/HeaderMenu';
import LocationPicker from './components/LocationPicker';
import { MapPinPlus } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [loc, setLoc] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_location');
      if (saved) setLoc(saved);
    } catch {}
  }, []);

  return (
    <main className="min-h-screen bg-[#fffff0] p-4 sm:p-6 lg:p-8">
      <HeaderMenu />
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-4">Coco Bakehouse</h1>

        <div className="rounded-xl border bg-white p-4 mb-4 space-y-3">
          <div className="font-semibold">เลือกสถานที่</div>
          <LocationPicker
            value={loc}
            onChange={(id) => {
              setLoc(id as string);
              try { localStorage.setItem('pos_location', id as string); } catch {}
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!loc}
              onClick={() => router.push('/pos')}
              className="px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] disabled:opacity-40"
            >
              ไปหน้า POS
            </button>

            <a
              href="/locations"
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              title="เพิ่ม/จัดการ Location"
            >
              <MapPinPlus className="w-4 h-4" />
              Add Location
            </a>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <a href="/history" className="rounded-xl border bg-white p-4 hover:bg-gray-50">
            <div className="font-semibold">History</div>
            <div className="text-sm text-gray-600">ดู End-of-Day / ดาวน์โหลด CSV</div>
          </a>
          <a href="/reports" className="rounded-xl border bg-white p-4 hover:bg-gray-50">
            <div className="font-semibold">Reports</div>
            <div className="text-sm text-gray-600">สรุปรายวัน/สัปดาห์/เดือน</div>
          </a>
          <a href="/products" className="rounded-xl border bg-white p-4 hover:bg-gray-50">
            <div className="font-semibold">Products</div>
            <div className="text-sm text-gray-600">จัดการรายการสินค้า (Toggle Active)</div>
          </a>
          {/* การ์ดลัดไปหน้า Locations */}
          <a href="/locations" className="rounded-xl border bg-white p-4 hover:bg-gray-50">
            <div className="font-semibold">Locations</div>
            <div className="text-sm text-gray-600">เพิ่ม/แก้ไขสาขา</div>
          </a>
        </div>
      </div>
    </main>
  );
}
