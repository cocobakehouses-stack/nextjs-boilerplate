'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Better than <a>
import HeaderMenu from './components/HeaderMenu';
import LocationPicker from './components/LocationPicker';
import { Plus, ChevronDown, ChevronUp, History, BarChart3, Package, ArrowRight, Store } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [loc, setLoc] = useState<string | null>(null);
  const [locPickerVersion, setLocPickerVersion] = useState(0);
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

      setNewId('');
      setNewLabel('');
      setLoc(id);
      localStorage.setItem('pos_location', id);
      setLocPickerVersion(v => v + 1);
      setManageOpen(false); // Close panel after success
    } catch (e: any) {
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffff0] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <HeaderMenu />
        
        <header className="space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-black uppercase">
            Coco Bakehouse
          </h1>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Store Management System</p>
        </header>

        {/* LOCATION SELECTOR & POS ACTION */}
        <section className="bg-white rounded-[2rem] border-4 border-black p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex items-center gap-2">
            <Store className="text-[#ac0000]" size={24} />
            <h2 className="text-xl font-black uppercase">Select Branch</h2>
          </div>

          <LocationPicker
            key={locPickerVersion}
            value={loc}
            onChange={(id) => {
              setLoc(id);
              localStorage.setItem('pos_location', id);
            }}
          />

          <button
            disabled={!loc}
            onClick={() => router.push('/pos')}
            className="w-full py-5 rounded-2xl bg-[#ac0000] text-white text-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-20 active:scale-95"
          >
            Enter POS <ArrowRight />
          </button>
        </section>

        {/* QUICK NAVIGATION */}
        <section className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'History', icon: <History />, href: '/history', desc: 'End-of-Day Logs' },
            { label: 'Reports', icon: <BarChart3 />, href: '/reports', desc: 'Analytics' },
            { label: 'Inventory', icon: <Package />, href: '/products', desc: 'Manage Menu' },
          ].map((item) => (
            <Link key={item.label} href={item.href} 
              className="bg-white border-2 border-black p-5 rounded-2xl hover:bg-black hover:text-white transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[#ac0000] group-hover:text-white">{item.icon}</span>
                <span className="font-black uppercase text-sm">{item.label}</span>
              </div>
              <p className="text-[10px] font-bold opacity-50 uppercase tracking-tight">{item.desc}</p>
            </Link>
          ))}
        </section>

        {/* ADMIN PANEL: BRANCH MANAGEMENT */}
        <section className="bg-white border-2 border-black rounded-2xl overflow-hidden">
          <button
            onClick={() => setManageOpen(!manageOpen)}
            className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <Plus size={16} /> Add / Update Branch
            </span>
            {manageOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {manageOpen && (
            <div className="p-6 space-y-4 border-t-2 border-black animate-in slide-in-from-top-2">
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  placeholder="ID (e.g., BK-01)"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toUpperCase())}
                  className="rounded-xl border-2 border-gray-100 px-4 py-3 font-bold text-sm outline-none focus:border-black"
                />
                <input
                  placeholder="Display Name"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="rounded-xl border-2 border-gray-100 px-4 py-3 font-bold text-sm outline-none focus:border-black sm:col-span-2"
                />
              </div>
              <button
                onClick={addLocation}
                disabled={adding}
                className="px-6 py-3 rounded-xl bg-black text-white font-black uppercase text-xs tracking-widest hover:bg-[#ac0000] transition-colors disabled:opacity-50"
              >
                {adding ? 'Saving...' : 'Sync Branch'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
