// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import LocationPicker from './components/LocationPicker';

const TZ = 'Asia/Bangkok';
function toDateString(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

export default function HomePage() {
  const [location, setLocation] = useState<string | null>(null);
  const [date, setDate] = useState<string>(toDateString(new Date()));

  // sync กับ header/pos
  useEffect(() => {
    const saved = (localStorage.getItem('pos_location') as string | null) || null;
    if (saved) setLocation(saved);
  }, []);
  useEffect(() => {
    if (location) localStorage.setItem('pos_location', location);
  }, [location]);

  // เพิ่มเมนูใหม่ (บล็อกนี้เท่านั้นที่ย่อ/ขยายได้)
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [busyAdd, setBusyAdd] = useState(false);
  const [addOpen, setAddOpen] = useState(false); // ⬅️ toggle เฉพาะส่วนเพิ่มเมนู

  const addProduct = async () => {
    const name = newName.trim();
    const price = Number(newPrice);
    if (!name || !Number.isFinite(price) || price <= 0) {
      alert('กรอกชื่อและราคาที่ถูกต้อง'); return;
    }
    try {
      setBusyAdd(true);
      const res = await fetch('/api/products', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Add product failed');
      setNewName(''); setNewPrice('');
      alert('เพิ่มเมนูสำเร็จ');
    } catch (e: any) {
      alert(e?.message || 'Add product failed');
    } finally {
      setBusyAdd(false);
    }
  };

  const open = (url: string) => window.open(url, '_blank');

  return (
    <main className="space-y-4">
      {/* เลือกสถานที่ (ไม่ย่อ/ขยาย) */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold mb-3">เลือกสถานที่</h2>
        <LocationPicker value={location} onChange={(id) => setLocation(id)} />
        {location && (
          <div className="text-sm text-gray-700">กำลังใช้งานสาขา: <b>{location}</b></div>
        )}
      </div>

      {/* เพิ่มเมนูใหม่ — ย่อ/ขยายได้เฉพาะส่วนนี้ */}
      <div className="rounded-xl border bg-white">
        <button
          className="w-full flex items-center justify-between px-4 py-3"
          onClick={() => setAddOpen(o => !o)}
        >
          <span className="text-lg font-semibold">เพิ่มเมนูใหม่ (เพิ่มลงแท็บ Products)</span>
          <span className="text-sm text-gray-600">{addOpen ? 'ซ่อน' : 'แสดง'}</span>
        </button>
        {addOpen && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                className="rounded-lg border px-3 py-2"
                placeholder="ชื่อเมนู"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="rounded-lg border px-3 py-2"
                placeholder="ราคา (เช่น 135)"
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <button
                onClick={addProduct}
                disabled={busyAdd || !newName.trim() || !Number.isFinite(Number(newPrice))}
                className="rounded-lg px-4 py-2 bg-[#ac0000] text-[#fffff0] disabled:opacity-40"
              >
                {busyAdd ? 'กำลังเพิ่ม…' : 'เพิ่มเมนู'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History (ไม่ย่อ/ขยาย) */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold mb-3">End of Day History</h2>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-sm text-gray-600">วันที่</label>
            <input
              type="date"
              className="rounded border px-3 py-2 bg-white"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button
            disabled={!location || !date}
            onClick={() => open(`/history?location=${encodeURIComponent(location!)}&date=${encodeURIComponent(date)}`)}
            className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] disabled:opacity-40"
          >
            เปิด History
          </button>
          <button
            disabled={!location || !date}
            onClick={() => open(`/api/history/csv?location=${encodeURIComponent(location!)}&date=${encodeURIComponent(date)}`)}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            ดาวน์โหลด CSV
          </button>
          <button
            disabled={!location || !date}
            onClick={() => open(`/api/history/pdf?location=${encodeURIComponent(location!)}&date=${encodeURIComponent(date)}`)}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            ดาวน์โหลด PDF
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          * เลือก <b>ALL</b> ใน Location เพื่อรวมทุกสาขาได้
        </div>
      </div>

      {/* Reports (ไม่ย่อ/ขยาย) */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold mb-3">Reports (Daily / Weekly / Monthly)</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/reports" className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
            ไปหน้า Reports
          </a>
          <a
            href={`/reports?location=${encodeURIComponent(location || '')}`}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
          >
            เปิด Reports พร้อม Location ปัจจุบัน
          </a>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          * หน้า Reports มีตัวเลือก Multiple / ALL ให้แล้ว
        </div>
      </div>
    </main>
  );
}
