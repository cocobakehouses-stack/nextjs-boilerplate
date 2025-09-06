// app/api/stocks/movements/csv/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../../lib/sheets';

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

function toCsvCell(s: string | number) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').trim().toUpperCase();
    const start = (url.searchParams.get('start') || '').trim();
    const end = (url.searchParams.get('end') || '').trim();

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
    const filtered = rows.filter((r: any[]) => {
      const d = (r?.[0] ?? '').toString().trim();
      const loc = (r?.[2] ?? '').toString().trim().toUpperCase();
      return loc === location && d >= start && d <= end;
    });

    const out = [
      ['Date','Time','Location','ProductID','ProductName','Delta','Reason'],
      ...filtered
    ]
      .map(arr => arr.map(toCsvCell).join(','))
      .join('\n');

    const filename = `stock_movements_${location}_${start}_${end}.csv`;
    return new NextResponse(out, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('GET /api/stocks/movements/csv error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
