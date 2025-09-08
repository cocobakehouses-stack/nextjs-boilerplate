// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HeaderMenu from './components/HeaderMenu';
import LocationPicker from './components/LocationPicker';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [loc, setLoc] = useState<string | null>(null);

  // สำหรับบังคับรีโหลด LocationPicker หลังเพิ่มสาขา (เปลี่ยน key จะรีเฟรชการ fetch)
  const [locPickerVersion, setLocPickerVersion] = useState(0);

  // พาเนล “เพิ่มสาขา”
  const [manageOpen, setManageOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('pos_location');
    if (saved) setLoc(saved);
  }, []);

  const idOk = (s: string) => /^[A-Z0-9_-]+$/.test(s);

  async function addLocation() {
    const id = (newId || '').trim().toUpperCase();
    const label = (newLabel || '').trim();
    if (!id || !label) return alert('กรอกให้ครบทั้งรหัสสาขาและชื่อที่แสดง');
    if (!idOk(id)) return alert('ID ใช้ได้เฉพาะ A–Z, 0–9, _ และ - เท่านั้น');

    setAdding(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'บันทึกไม่สำเร็จ');

      // เคลียร์ฟอร์ม + รีโหลด LocationPicker + เซ็ตเลือกสาขาใหม่
      setNewId('');
      setNewLabel('');
      setLoc(id);
      try { localStorage.setItem('pos_location', id); } catch {}
      setLocPickerVersion(v => v + 1); // บังคับให้ LocationPicker รีเฟรชข้อมูล
    } catch (e: any) {
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffff0] p-4 sm:p-6 lg:p-8">
      <HeaderMenu />
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-4">Coco Bakehouse</h1>

        {/* เลือกสถานที่ */}
        <div className="rounded-xl border bg-white p-4 mb-4 space-y-3">
          <div className="font-semibold">เลือกสถานที่</div>
          <LocationPicker
            key={locPickerVersion}
            value={loc}
            onChange={(id) => {
              setLoc(id);
              try { localStorage.setItem('pos_location', id); } catch {}
            }}
          />

          <div className="flex gap-2">
            <button
              disabled={!loc}
              onClick={() => router.push('/pos')}
              className="px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] disabled:opacity-40"
            >
              ไปหน้า POS
            </button>
          </div>
        </div>

        {/* พาเนลเพิ่มสาขา (ย่อ/ขยายได้) */}
        <div className="rounded-xl border bg-white mb-6">
          <button
            onClick={() => setManageOpen(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3"
            aria-expanded={manageOpen}
          >
            <div className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              เพิ่ม/แก้ไขสาขาอย่างเร็ว
            </div>
            {manageOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {manageOpen && (
            <div className="px-4 pb-4 space-y-3">
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  placeholder="รหัสสาขา เช่น FLAGSHIP"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toUpperCase())}
                  className="rounded border px-3 py-2"
                />
                <input
                  placeholder="ชื่อที่แสดง เช่น Coco Flagship"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="rounded border px-3 py-2 sm:col-span-2"
                />
              </div>
              <div className="text-xs text-gray-500">
                * ID ใช้อักษร A–Z, ตัวเลข, _ หรือ - (ระบบจะอัปเดต/สร้างใหม่ให้อัตโนมัติ)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addLocation}
                  disabled={adding}
                  className="px-3 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {adding ? 'กำลังบันทึก…' : 'เพิ่ม/อัปเดตสาขา'}
                </button>
                <button
                  onClick={() => { setNewId(''); setNewLabel(''); }}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                >
                  ล้างฟอร์ม
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ลิงก์ไปส่วนอื่น */}
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
        </div>
      </div>
    </main>
  );
}
