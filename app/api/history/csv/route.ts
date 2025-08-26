// app/api/history/csv/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
  location?: string;
  time?: string;
  billNo?: string;
  items?: string;
  totalQty?: number;
  payment?: string;
  total?: number;
  freebies?: string;
};

function csvEscape(val: unknown) {
  const s = String(val ?? '');
  // แทนที่ " ด้วย "" แล้วห่อด้วย "
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const location = (url.searchParams.get('location') || '').toUpperCase();
  const date = url.searchParams.get('date') || '';

  if (!date) {
    return NextResponse.json({ error: 'missing date' }, { status: 400 });
  }

  // ดึง JSON จาก /api/history (ให้ /api/history เป็นตัวรวมข้อมูล ALL)
  const api = `${url.origin}/api/history?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`;
  const res = await fetch(api, { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json({ error: 'failed to load history' }, { status: 500 });
  }

  const data = await res.json();
  const rows: Row[] = data?.rows || [];

  const includeLocCol = rows.some(r => r.location) || location === 'ALL';
  const header = includeLocCol
    ? ['Location','Time','Bill','Items','Qty','Payment','Total','Freebies']
    : ['Time','Bill','Items','Qty','Payment','Total','Freebies'];

  const lines: string[] = [];
  lines.push(header.join(','));

  for (const r of rows) {
    const items = (r.items ?? '').replace(/\r?\n/g, ' ');
    const freebies = (r.freebies ?? '').replace(/\r?\n/g, ' ');
    const cols = includeLocCol
      ? [
          csvEscape(r.location ?? ''),
          csvEscape(r.time ?? ''),
          csvEscape(r.billNo ?? ''),
          csvEscape(items),
          csvEscape(r.totalQty ?? 0),
          csvEscape(r.payment ?? ''),
          csvEscape((Number(r.total ?? 0)).toFixed(2)),
          csvEscape(freebies),
        ]
      : [
          csvEscape(r.time ?? ''),
          csvEscape(r.billNo ?? ''),
          csvEscape(items),
          csvEscape(r.totalQty ?? 0),
          csvEscape(r.payment ?? ''),
          csvEscape((Number(r.total ?? 0)).toFixed(2)),
          csvEscape(freebies),
        ];
    lines.push(cols.join(','));
  }

  const csv = lines.join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="history_${location || 'ALL'}_${date}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
