// app/api/history/csv/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  ALLOWED_TABS,
  toBangkokDateString,
  getAuth,
  fetchHistory,
} from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ใช้ type ภายในไฟล์นี้เพื่อกัน implicit any เวลาทำ map/filter
type HistoryRow = {
  date: string;
  time: string;
  billNo: string;
  items: string;
  freebies: string;
  totalQty: number;
  payment: string;
  total: number;
  freebiesAmount: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    if (!ALLOWED_TABS.has(location)) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

    // เตรียม Google Sheets client
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ดึงข้อมูลทั้งหมดของ location (ทุกวัน) แล้วค่อย filter เอาเฉพาะวันที่เลือก
    const { rows } = await fetchHistory(sheets, spreadsheetId, location);
    const filtered: HistoryRow[] = (rows as HistoryRow[]).filter(
      (r: HistoryRow) => r.date === date
    );

    // ทำ CSV (เพิ่มคอลัมน์ FreebiesAmount ด้วย)
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
      ...filtered.map((r: HistoryRow) =>
        [
          r.date,
          r.time,
          r.billNo,
          JSON.stringify(r.items), // เผื่อมี comma/semicolon ในข้อความ
          JSON.stringify(r.freebies),
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
