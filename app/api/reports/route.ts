// app/api/reports/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  ensureSheetExists,
  fetchHistoryRange,
  aggregateByPeriod,
  summarizeTotals,
  type Period,
  toBangkokDateString,
} from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function defaultRange(period: Period) {
  const now = new Date();
  const today = toBangkokDateString(now);

  if (period === 'daily') {
    return { start: today, end: today };
  }

  if (period === 'weekly') {
    // จันทร์ต้นสัปดาห์ -> อาทิตย์สุดสัปดาห์ (Asia/Bangkok)
    const d = new Date(`${today}T00:00:00+07:00`);
    const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
    const startD = new Date(d);
    startD.setDate(d.getDate() - day);
    const endD = new Date(startD);
    endD.setDate(startD.getDate() + 6);
    return { start: toBangkokDateString(startD), end: toBangkokDateString(endD) };
  }

  // monthly
  const [y, m] = today.split('-').map(Number);
  const startD = new Date(Date.UTC(y, m - 1, 1));
  const endD = new Date(Date.UTC(y, m, 0)); // last day of month
  return {
    start: toBangkokDateString(startD),
    end: toBangkokDateString(endD),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || 'ORDERS').toUpperCase();
    const period = (url.searchParams.get('period') || 'daily') as Period;
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    const { start: sDef, end: eDef } = defaultRange(period);
    const startDate = start || sDef;
    const endDate = end || eDef;

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ให้แน่ใจว่ามีแท็บปลายทาง (สร้างอัตโนมัติถ้าไม่มี)
    await ensureSheetExists(sheets, spreadsheetId, location);

    // ⬇️ เรียกด้วย 4 อาร์กิวเมนต์: (sheets, spreadsheetId, tabTitle, { start, end })
    const rows = await fetchHistoryRange(sheets, spreadsheetId, location, { start: startDate, end: endDate });

    // รายการรวมทั้งช่วง (grand total)
    const grand = summarizeTotals(rows);

    // สรุปแบ่งตาม period
    const buckets = aggregateByPeriod(rows, period);

    return NextResponse.json(
      {
        location,
        period,
        range: { start: startDate, end: endDate },
        grand,
        buckets,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('GET /api/reports error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
