// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ใช้ string ก็พอสำหรับหน้า Home (ไม่ผูกกับ type ภายนอก)
type LocationRow = { id: string; label: string };
type NewLocState = { id: string; label: string };

export default function Home() {
  const router = useRouter();

  // สาขาที่เลือกไว้ (อ่านจาก localStorage)
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const saved = (localStorage.getItem('pos_location') as string | null) || null;
    if (saved) setSelected(saved);
  }, []);

  // รายการสาขาแบบไดนามิกจาก API
  const [locs, setLocs] = useState<LocationRow[]>([]);
  const [loadingLocs, setLoadingLocs] = useState<boolean>(true);

  const loadLocations = async () => {
    try {
      setLoadingLocs(true);
      const res = await fetch('/api/locations', { cache: 'no-store' });
      const data = await res.json();
      setLocs(data?.locations || []);
    } catch {
      // กรณีพลาด ให้ลิสต์ว่างไว้ก่อน
      setLocs([]);
    } finally {
      setLoadingLocs(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const choose = (loc: string) => {
    localStorage.setItem('pos_location', loc);
    setSelected(loc);
    router.push('/pos'); // ไปหน้า POS ทันที
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // --- ฟอร์มเพิ่มสาขาใหม่ ---
  const [adding, setAdding] = useState<NewLocState>({ id: '', label: '' });
  const [busyAdd, setBusyAdd] = useState(false);

  const addLocation = async () => {
    if (!adding.id.trim() || !adding.label.trim()) return;
    try {
      setBusyAdd(true);
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: adding.id.trim().toUpperCase(), // A–Z,0–9,_
          label: adding.label.trim(),         // ชื่อไทย
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Add failed');
      await loadLocations();               // รีโหลดลิสต์
      setAdding({ id: '', label: '' });    // เคลียร์ฟอร์ม
      alert('เพิ่มสถานที่สำเร็จ และสร้างแท็บใน Google Sheets แล้ว');
    } catch (e: any) {
      alert(e?.message || 'Add failed');
    } finally {
      setBusyAdd(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffff0] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Coco Bakehouse POS</h1>
        <p className="text-gray-700 mb-6">เลือกสาขาก่อนเริ่มทำรายการ</p>

        {/* รายการสาขา */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loadingLocs ? (
            <div className="col-span-3 text-gray-600">Loading locations…</div>
          ) : locs.length === 0 ? (
            <div className="col-span-3 text-gray-600">ยังไม่มีสาขา — โปรดเพิ่มสาขาใหม่ด้านล่าง</div>
          ) : (
            locs.map((l) => (
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
            ))
          )}
        </div>

        {/* Action bar ของสาขาที่เลือกไว้ (ถ้ามี) */}
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
              onClick={() =>
                router.push(
                  `/history?location=${encodeURIComponent(selected)}&date=${todayStr}`
                )
              }
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

        {/* ฟอร์มเพิ่มสาขาใหม่ */}
        <div className="mt-8 rounded-xl border bg-white p-4">
          <div className="font-semibold mb-2">เพิ่มสถานที่ใหม่</div>
          <p className="text-sm text-gray-600 mb-3">
            ระบบจะเพิ่มรายการลงแท็บ <b>Locations</b> และสร้างแท็บสาขาใหม่ (พร้อมหัวคอลัมน์) ให้อัตโนมัติ
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600">ชื่อภาษาไทย (Label)</label>
              <input
                className="w-full rounded border px-3 py-2"
                value={adding.label}
                onChange={(e) => setAdding((s) => ({ ...s, label: e.target.value }))}
                placeholder="เช่น หน้าร้าน / สินธร / ชินวัตร 3"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">
                ID อังกฤษ (A–Z, 0–9, _ ไม่มีเว้นวรรค)
              </label>
              <input
                className="w-full rounded border px-3 py-2 uppercase"
                value={adding.id}
                onChange={(e) =>
                  setAdding((s) => ({ ...s, id: e.target.value.toUpperCase() }))
                }
                placeholder="เช่น FLAGSHIP / SINDHORN / CHIN3"
              />
            </div>
          </div>

          <div className="mt-3">
            <button
              disabled={busyAdd || !adding.id.trim() || !adding.label.trim()}
              onClick={addLocation}
              className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] disabled:opacity-40"
            >
              {busyAdd ? 'กำลังเพิ่ม…' : 'เพิ่มสถานที่'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
