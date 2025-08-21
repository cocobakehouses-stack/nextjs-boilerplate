// app/api/history/csv/route.ts
import { NextResponse } from 'next/server';
import {
  ALLOWED_TABS,
  fetchHistory,
  toBangkokDateString,
  type HistoryRow,
} from '../../../lib/sheets';

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

    // ✅ เรียกตาม signature ปัจจุบัน: (spreadsheetId, tabTitle, date)
    const { rows } = await fetchHistory(spreadsheetId, location, date);

    // เผื่อ type ในโปรเจกต์ยังไม่ได้ export ให้ cast เป็น HistoryRow[]
    const data: HistoryRow[] = rows as HistoryRow[];

    // Header รวม FreebiesAmount ตามที่ต้องการ
    const header = [
      'Date',
      'Time',
      'BillNo',
      'Items',
      'Freebies',
      'TotalQty',
      'Payment',
      'Total',
      'FreebiesAmount',
    ];

    const csvLines = [
      header.join(','),
      ...data.map((r) =>
        [
          r.date,
          r.time,
          r.billNo,
          JSON.stringify(r.items),     // กัน comma แตกคอลัมน์
          JSON.stringify(r.freebies),  // กัน comma แตกคอลัมน์
          String(r.totalQty),
          r.payment,
          (r.total ?? 0).toFixed(2),
          (r.freebiesAmount ?? 0).toFixed(2),
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
