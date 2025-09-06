// app/api/stocks/movements/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../../lib/sheets'; // ← ขึ้นสามชั้นไปถึง app/lib

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOVES_TAB = 'STOCK_MOVEMENTS';

async function ensureMovesSheet(sheets: any, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const exists = (meta.data.sheets ?? []).some(
    (s: any) => s.properties?.title === MOVES_TAB
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: MOVES_TAB } } }] },
    });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${a1Sheet(MOVES_TAB)}!A1:G1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        'Date','Time','Location','ProductID','ProductName','Delta','Reason'
      ]],
    },
  });
}

type MovementRow = {
  date: string;
  time: string;
  location: string;
  productId: number;
  productName: string;
  delta: number;
  reason?: string;
};

function num(x: any) {
  const n = Number(String(x ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').trim().toUpperCase();
    const start = (url.searchParams.get('start') || '').trim(); // YYYY-MM-DD
    const end   = (url.searchParams.get('end')   || '').trim(); // YYYY-MM-DD

    if (!location || !start || !end) {
      return NextResponse.json({ error: 'location, start, end are required' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureMovesSheet(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(MOVES_TAB)}!A:G`,
    });

    const rows = (res.data.values || []).slice(1);
    const list: MovementRow[] = rows.map((r: any[]) => ({
      date: (r?.[0] ?? '').toString().trim(),
      time: (r?.[1] ?? '').toString().trim(),
      location: (r?.[2] ?? '').toString().trim().toUpperCase(),
      productId: num(r?.[3]),
      productName: (r?.[4] ?? '').toString().trim(),
      delta: num(r?.[5]),
      reason: (r?.[6] ?? '').toString().trim(),
    }))
    .filter(r => r.location === location && r.date >= start && r.date <= end)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

    return NextResponse.json({ movements: list }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/stocks/movements error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
