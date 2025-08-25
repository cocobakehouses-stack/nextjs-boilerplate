// app/components/AppHeader.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LocationPicker from './LocationPicker';

export default function AppHeader() {
  const [location, setLocation] = useState<string | null>(null);

  useEffect(() => {
    const saved = (localStorage.getItem('pos_location') as string | null) || null;
    if (saved) setLocation(saved);
  }, []);

  useEffect(() => {
    if (location) localStorage.setItem('pos_location', location);
  }, [location]);

  return (
    <header className="w-full sticky top-0 z-30 bg-[#fffff0]/85 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
        {/* Left: brand + nav */}
        <div className="flex items-center gap-2">
          <Link href="/" className="font-bold text-xl hover:opacity-80">🏠 Home</Link>
          <nav className="ml-2 flex items-center gap-2 text-sm">
            <Link className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50" href="/pos">POS</Link>
            <Link className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50" href="/history">History</Link>
            <Link className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50" href="/reports">Reports</Link>
          </nav>
        </div>

        {/* Right: location picker (same behavior) */}
        <div className="flex items-end gap-2">
          <LocationPicker value={location} onChange={(id) => setLocation(id)} />
          {location && (
            <button
              onClick={() => { localStorage.removeItem('pos_location'); setLocation(null); }}
              className="px-3 py-2 rounded-lg border bg-white text-sm"
            >
              ล้างสถานที่
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
