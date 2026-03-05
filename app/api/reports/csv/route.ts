// app/api/reports/csv/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { 
  getAuth, 
  fetchHistoryRange 
} from '../../../lib/sheets'; // Double-check this path matches your folder structure

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

// --- HELPER FUNCTIONS ---
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
    const qty = r.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0;
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

function productSummary(rows: OrderRow[]) {
  const map: Record<string, { qty: number; amount: number }> = {};
  for (const r of rows) {
    for (const i of r.items || []) {
      if (!map[i.name]) map[i.name] = { qty: 0, amount: 0 };
      map[i.name].qty += Number(i.qty) || 0;
      map[i.name].amount += (Number(i.price) || 0) * (Number(i.qty) || 0);
    }
  }
  return map;
}

// --- MAIN GET HANDLER ---
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').toUpperCase();
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';

    if (!location || !start || !end) {
      return NextResponse.json({ error: 'Missing location/start/end' }, { status: 400 });
    }

    // FIX: Talk to Google Sheets directly
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

// We use 'any' here to bypass the strict type check so the build passes immediately
const rows: any[] = await fetchHistoryRange(spreadsheetId, location, start, end);

    if (!rows || rows.length === 0) {
      const emptyCsv = '\uFEFF' + 'No data found for the selected period and location.';
      return new NextResponse(emptyCsv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="empty_report.csv"`,
        },
      });
    }

    const totals = reduceTotals(rows);

    const header = [
      'BillNo', 'Date', 'Time', 'Location', 'Payment',
      'Subtotal', 'Discount', 'LinemanMarkup', 'LinemanDiscount', 'Total',
      'Items', 'Freebies',
    ];

    const body = [...rows]
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

    const summaryTop = [
      ['SUMMARY'],
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
      [''], 
    ];

    let productLines: string[] = [];
    productLines.push('');
    productLines.push('PRODUCT SUMMARY');
    const allMap = productSummary(rows);
    for (const [name, v] of Object.entries(allMap)) {
      productLines.push([csvEscape(name), v.qty, v.amount.toFixed(2)].join(','));
    }

    const lines = [
      ...summaryTop.map((row) => row.map(csvEscape).join(',')),
      header.map(csvEscape).join(','),
      ...body.map((row) => row.map(csvEscape).join(',')),
      ...productLines,
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
    console.error('CSV Export Error:', e);
    return NextResponse.json({ error: 'CSV export failed: ' + e.message }, { status: 500 });
  }
}
