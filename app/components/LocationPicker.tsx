// app/components/LocationPicker.tsx
'use client';

import { useEffect, useState } from 'react';

type LocationRow = { id: string; label: string };

type Props = {
  value: string | null;
  onChange: (id: string) => void;
  includeAll?: boolean; // ⬅️ เพิ่ม option ALL
};

export default function LocationPicker({ value, onChange, includeAll = false }: Props) {
  const [locs, setLocs] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/locations', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const apiList: LocationRow[] = data?.locations || [];
      setLocs(apiList);
    } catch {
      setLocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="mb-4 flex items-end gap-2">
      <div>
        <label className="block text-sm text-gray-600">เลือกสถานที่</label>
        <select
          className="rounded border px-3 py-2 bg-white"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>— เลือกสถานที่ —</option>
          {includeAll && <option value="ALL">All (ทุกสาขา)</option>}
          {locs.map((l) => (
            <option key={l.id} value={l.id}>{l.label} ({l.id})</option>
          ))}
        </select>
      </div>
      <button onClick={load} className="px-3 py-2 rounded-lg border bg-white text-sm" disabled={loading}>
        {loading ? 'กำลังโหลด…' : 'โหลดใหม่'}
      </button>
    </div>
  );
}
