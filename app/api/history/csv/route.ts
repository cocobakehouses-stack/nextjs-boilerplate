// app/api/history/csv/route.ts
import { NextResponse } from 'next/server';
import { ALLOWED_TABS, fetchHistory, toBangkokDateString } from '../../../lib/sheets';

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

    const { rows } = await fetchHistory(spreadsheetId, location, date);

    const header = ['Date','Time','BillNo','Items','Freebies','TotalQty','Payment','Total'];
    const csvLines = [
      header.join(','),
      ...rows.map(r => [
        r.date, r.time, r.billNo,
        JSON.stringify(r.items), // กันคอมม่าในข้อความ
        JSON.stringify(r.freebies),
        String(r.totalQty),
        r.payment,
        r.total.toFixed(2),
      ].join(','))
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
