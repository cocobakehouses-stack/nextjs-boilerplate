// app/api/history/csv/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type HistoryRow = {
  location?: string;
  time?: string;
  billNo?: string;
  items?: string;
  freebies?: string;
  totalQty?: number;
  payment?: string;
  total?: number;
  freebiesAmount?: number;
};

function csvEscape(s: unknown): string {
  if (s === null || s === undefined) return '';
  const str = String(s);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function rowsToCsv(rows: HistoryRow[], includeLocation: boolean) {
  const header = includeLocation
    ? ['Location', 'Time', 'Bill', 'Items', 'Qty', 'Payment', 'Total', 'Freebies', 'FreebiesAmount']
    : ['Time', 'Bill', 'Items', 'Qty', 'Payment', 'Total', 'Freebies', 'FreebiesAmount'];

  const lines = [header.join(',')];

  for (const r of rows) {
    const cols = includeLocation
      ? [
          r.location ?? '',
          r.time ?? '',
          r.billNo ?? '',
          r.items ?? '',
          String(r.totalQty ?? 0),
          r.payment ?? '',
          (Number(r.total ?? 0)).toFixed(2),
          r.freebies ?? '',
          (Number(r.freebiesAmount ?? 0)).toFixed(2),
        ]
      : [
          r.time ?? '',
          r.billNo ?? '',
          r.items ?? '',
          String(r.totalQty ?? 0),
          r.payment ?? '',
          (Number(r.total ?? 0)).toFixed(2),
          r.freebies ?? '',
          (Number(r.freebiesAmount ?? 0)).toFixed(2),
        ];
    lines.push(cols.map(csvEscape).join(','));
  }

  // ใส่ BOM กันภาษาไทยเพี้ยน + ใช้ CRLF ให้ Excel แฮปปี้
  return '\uFEFF' + lines.join('\r\n');
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || '';
    const loc = (url.searchParams.get('location') || 'ALL').toUpperCase();

    if (!date) {
      return NextResponse.json({ error: 'missing date' }, { status: 400 });
    }

    // สร้าง origin จาก header (รองรับ proxy บน Vercel)
    const h = req.headers;
    const proto = h.get('x-forwarded-proto') || url.protocol.replace(':', '');
    const host = h.get('x-forwarded-host') || url.host;
    const base = `${proto}://${host}`;

    // ถ้ามี Protection Bypass token ใส่ไปทั้ง header และ cookie
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      || process.env.VERCEL_PROTECTION_BYPASS
      || process.env.PROTECTION_BYPASS_TOKEN
      || '';

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (bypass) {
      headers['x-vercel-protection-bypass'] = bypass;
      headers['Cookie'] = `vercel-protection-bypass=${bypass}`;
    }

    // ดึงข้อมูลจาก /api/history (ในโปรเจกต์เดียวกัน)
    const api = new URL('/api/history', base);
    api.searchParams.set('location', loc);
    api.searchParams.set('date', date);

    const res = await fetch(api.toString(), { cache: 'no-store', headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `failed to load history (${res.status})`, detail: detail.slice(0, 500) },
        { status: 500 },
      );
    }

    const data = await res.json();
    const rows: HistoryRow[] = data?.rows || [];
    const includeLoc = loc === 'ALL' || rows.some((r) => (r.location ?? '').trim() !== '');

    const csv = rowsToCsv(rows, includeLoc);
    const filename = `history_${loc}_${date}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('GET /api/history/csv error', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
