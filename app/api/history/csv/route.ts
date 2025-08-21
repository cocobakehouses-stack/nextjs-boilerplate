// app/api/history/csv/route.ts
import { NextResponse } from 'next/server';
import { ALLOWED_TABS, fetchHistory, toBangkokDateString, type HistoryRow, getAuth } from '../../../lib/sheets';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    if (!ALLOWED_TABS.has(location)) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

    // init sheets API
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // โหลดข้อมูลทั้งหมดของ location
    const { history } = await fetchHistory(sheets, spreadsheetId, location);

    // filter เฉพาะวันที่เลือก
    const rows = history.filter((r: HistoryRow) => r.date === date);

    const header = [
      'Date',
      'Time',
      'BillNo',
      'Items',
      'Freebies',
      'TotalQty',
      'Payment',
      'Total',
      'FreebiesAmount'
    ];

    const csvLines = [
      header.join(','),
      ...rows.map((r: HistoryRow) =>
        [
          r.date,
          r.time,
          r.billNo,
          JSON.stringify(r.items),
          JSON.stringify(r.freebies),
          String(r.totalQty),
          r.payment,
          r.total.toFixed(2),
          r.freebiesAmount.toFixed(2),
        ].join(',')
      ),
    ];

    const csv = csvLines.join('\n');
    const fileName = `EOD_${location}_${date}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('GET /api/history/csv error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
