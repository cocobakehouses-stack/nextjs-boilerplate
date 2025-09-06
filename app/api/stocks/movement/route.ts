// app/api/stocks/movements/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExistsIdempotent } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';
const TZ = 'Asia/Bangkok';

function a1(title: string) {
  return `'${String(title).replace(/'/g, "''")}'`;
}
function num(x: any) {
  const v = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(v) ? v : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').toUpperCase();
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';

    if (!location || !start || !end) {
      return NextResponse.json({ error: 'missing location/start/end' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureSheetExistsIdempotent(sheets, spreadsheetId, STOCKS_TAB);

    // A:Date B:Time C:Location D:ProductId E:ProductName F:Delta G:Reason H:User
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1(STOCKS_TAB)}!A:H`,
    });

    const rows = (res.data.values || []).slice(1);
    const list = rows
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

    // เรียงใหม่ -> เก่า
    list.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

    return NextResponse.json({ location, movements: list }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/stocks/movements error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
