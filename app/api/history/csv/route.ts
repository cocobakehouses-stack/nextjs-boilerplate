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

  // BOM + CRLF ให้ Excel อ่านไทยได้ถูก
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

    // ✅ เรียกใช้ /api/history ในโปรเซสเดียวกัน (ไม่วิ่งเครือข่าย)
    //    - import ตัว route แล้วเรียกฟังก์ชัน GET โดยตรง
    const { GET: historyGET } = await import('../route'); // app/api/history/route.ts
    const internalReq = new Request(
      // ใช้ base ใดๆ ก็ได้ เพราะเราไม่ออกนอกโปรเซส
      `http://local/api/history?location=${encodeURIComponent(loc)}&date=${encodeURIComponent(date)}`,
      { headers: { Accept: 'application/json' } }
    );

    const resp = await (historyGET as (r: Request, ctx?: any) => Promise<Response>)(internalReq);
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return NextResponse.json(
        { error: `failed to load history (${resp.status})`, detail: detail.slice(0, 500) },
        { status: 500 }
      );
    }

    const data = await resp.json();
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
