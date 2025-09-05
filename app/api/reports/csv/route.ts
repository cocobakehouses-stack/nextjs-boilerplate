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
  return list.map(i => `${i.name} x${i.qty}@${i.price}`).join('; ');
}

function reduceTotals(rows: OrderRow[]) {
  let count = rows.length;
  let totalQty = 0;
  let totalAmount = 0;
  let freebiesAmount = 0;
  const byPayment: Record<string, number> = {};

  for (const r of rows) {
    const qty = r.items.reduce((s, i) => s + (i.qty || 0), 0);
    const freeAmt = (r.freebies || []).reduce(
      (s, f) => s + (Number(f.qty) || 0) * (Number(f.price) || 0),
      0
    );
    totalQty += qty;
    totalAmount += Number(r.total || 0);
    freebiesAmount += freeAmt;
    const key = r.payment || '-';
    byPayment[key] = (byPayment[key] || 0) + Number(r.total || 0);
  }
  return { count, totalQty, totalAmount, freebiesAmount, byPayment };
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

    const qs = new URLSearchParams({ location, start, end });
    const base = `${url.origin}`;
    const res = await fetch(`${base}/api/reports?${qs.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const rows: OrderRow[] = Array.isArray(data?.rows) ? data.rows : [];

    const totals = reduceTotals(rows);

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

    const body = rows
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

    // --- summary lines (บน/ล่าง) ---
    const summaryTop = [
      ['SUMMARY (Top)'],
      [`Bills: ${totals.count}`],
      [`Total Qty: ${totals.totalQty}`],
      [`Total Amount: ${totals.totalAmount.toFixed(2)}`],
      [`Freebies Amount: ${totals.freebiesAmount.toFixed(2)}`],
      [
        'By Payment: ' +
          Object.entries(totals.byPayment)
            .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
            .join(' | '),
      ],
      [''], // ช่องว่าง
    ];

    const summaryBottom = [
      [''],
      ['SUMMARY (Bottom)'],
      [`Bills: ${totals.count}`],
      [`Total Qty: ${totals.totalQty}`],
      [`Total Amount: ${totals.totalAmount.toFixed(2)}`],
      [`Freebies Amount: ${totals.freebiesAmount.toFixed(2)}`],
      [
        'By Payment: ' +
          Object.entries(totals.byPayment)
            .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
            .join(' | '),
      ],
    ];

    const lines = [
      ...summaryTop.map((row) => row.map(csvEscape).join(',')),
      header.map(csvEscape).join(','),
      ...body.map((row) => row.map(csvEscape).join(',')),
      ...summaryBottom.map((row) => row.map(csvEscape).join(',')),
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
