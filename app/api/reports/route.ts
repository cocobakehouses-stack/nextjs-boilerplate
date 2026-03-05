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
    
    // 1. Get query params
    const queryStart = url.searchParams.get('start');
    const queryEnd = url.searchParams.get('end');

    // 2. Logic: If user provides specific dates, use them. Otherwise, use period defaults.
    let startDate: string;
    let endDate: string;

    if (queryStart && queryEnd) {
      startDate = queryStart;
      endDate = queryEnd;
    } else {
      const { start: sDef, end: eDef } = defaultRange(period);
      startDate = sDef;
      endDate = eDef;
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureSheetExists(sheets, spreadsheetId, location);

    // Fetching data
    const rows = await fetchHistoryRange(spreadsheetId, location, startDate, endDate);

    // If rows are empty, return an empty array instead of failing
    if (!rows || rows.length === 0) {
        return NextResponse.json({ 
            location, 
            range: { start: startDate, end: endDate }, 
            rows: [], 
            grand: {}, 
            buckets: {} 
        });
    }

    const grand = summarizeTotals(rows);
    const buckets = aggregateByPeriod(rows, period);

    return NextResponse.json(
      {
        location,
        period,
        range: { start: startDate, end: endDate },
        grand,
        buckets,
        rows,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('GET /api/reports error', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
