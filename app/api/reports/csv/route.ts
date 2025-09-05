// app/api/reports/csv/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Line = { name: string; qty: number; price: number };
type OrderRow = {
  date: string;
  time: string;
  billNo: string;
  location: string;
  items: Line[];
  freebies: Line[];
  subtotal: number;
  discount?: number;
  linemanMarkup?: number;
  linemanDiscount?: number;
  total: number;
  payment: 'cash' | 'promptpay' | 'lineman';
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatItems(list: Line[] = []): string {
  // ex: "Brownie x2@65; Cookie x1@135"
  return list.map(i => `${i.name} x${i.qty}@${i.price}`).join('; ');
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = url.searchParams.get('location') || '';
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';

    if (!location || !start || !end) {
      return NextResponse.json({ error: 'Missing location/start/end' }, { status: 400 });
    }

    // ดึงข้อมูลจาก /api/reports (รีไซเคิลของเดิม)
    const qs = new URLSearchParams({ location, start, end });
    const base = `${url.origin}`;
    const res = await fetch(`${base}/api/reports?${qs.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    const rows: OrderRow[] = Array.isArray(data?.rows) ? data.rows : [];

    // Header
    const header = [
      'BillNo',
      'Date',
      'Time',
      'Location',
      'Payment',
      'Subtotal',
      'Discount',
      'LinemanMarkup',
      'LinemanDiscount',
      'Total',
      'Items',
      'Freebies',
    ];

    // Rows
    const body = rows
      // เรียงบิลจากมาก → น้อยตาม requirement
      .sort((a, b) => Number(b.billNo) - Number(a.billNo))
      .map((r) => [
        r.billNo ?? '',
        r.date ?? '',
        r.time ?? '',
        r.location ?? '',
        r.payment ?? '',
        (r.subtotal ?? 0).toFixed(2),
        (r.discount ?? 0).toFixed(2),
        (r.linemanMarkup ?? 0).toFixed(2),
        (r.linemanDiscount ?? 0).toFixed(2),
        (r.total ?? 0).toFixed(2),
        formatItems(r.items || []),
        formatItems(r.freebies || []),
      ]);

    // สร้าง CSV (ใส่ UTF-8 BOM ให้ Excel/Google Sheets อ่านภาษาไทยถูก)
    const lines = [
      header.map(csvEscape).join(','),
      ...body.map((row) => row.map(csvEscape).join(',')),
    ];
    const csv = '\uFEFF' + lines.join('\n');

    const filename = `reports_${location}_${start}_${end}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('GET /api/reports/csv error:', e?.message || e);
    return NextResponse.json({ error: 'CSV export failed' }, { status: 500 });
  }
}
