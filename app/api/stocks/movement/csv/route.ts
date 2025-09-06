// app/api/stocks/movements/csv/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExistsIdempotent } from '../../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';

function a1(title: string) {
  return `'${String(title).replace(/'/g, "''")}'`;
}
function num(x: any) {
  const v = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(v) ? v : 0;
}
function toCsv(rows: string[][]) {
  return rows
    .map(r =>
      r
        .map((cell) => {
          const s = cell ?? '';
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(',')
    )
    .join('\n');
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').toUpperCase();
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';

    if (!location || !start || !end) {
      return new NextResponse('missing location/start/end', { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureSheetExistsIdempotent(sheets, spreadsheetId, STOCKS_TAB);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1(STOCKS_TAB)}!A:H`,
    });

    const rows = (res.data.values || []).slice(1);
    const filtered = rows
      .map((r: any[]) => ({
        date: (r?.[0] ?? '').toString().trim(),
        time: (r?.[1] ?? '').toString().trim(),
        location: (r?.[2] ?? '').toString().trim().toUpperCase(),
        productId: num(r?.[3]),
        productName: (r?.[4] ?? '').toString().trim(),
        delta: num(r?.[5]),
        reason: (r?.[6] ?? '').toString().trim(),
        user: (r?.[7] ?? '').toString().trim(),
      }))
      .filter(r => r.location === location && r.date >= start && r.date <= end);

    const csvRows: string[][] = [
      ['Date','Time','Location','ProductId','ProductName','Delta','Reason','User'],
      ...filtered.map(r => [
        r.date, r.time, r.location,
        String(r.productId), r.productName,
        String(r.delta), r.reason, r.user
      ])
    ];

    const csv = toCsv(csvRows);
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="movements_${location}_${start}_${end}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('GET /api/stocks/movements/csv error', e?.message || e);
    return new NextResponse('failed', { status: 500 });
  }
}
