'use client';

import { LOCATIONS, type LocationId } from '@/data/locations';
import { useEffect, useState } from 'react';

type Props = {
  value: string | null;
  onChange: (loc: LocationId) => void;
};

export default function LocationPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!value) setOpen(true);
  }, [value]);

  function choose(loc: LocationId) {
    localStorage.setItem('pos_location', loc);
    onChange(loc);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-center mb-4">เลือกสถานที่ขาย</h2>
        <div className="grid gap-3">
          {LOCATIONS.map((l) => (
            <button
              key={l.id}
              onClick={() => choose(l.id)}
              className="w-full py-4 text-lg font-semibold rounded-xl border hover:bg-gray-50"
            >
              {l.label} <span className="text-gray-500 text-base">({l.id})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
