// app/api/stocks/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExists, TZ } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';

function a1Sheet(title: string) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get('location');
    if (!location) {
      return NextResponse.json({ error: 'location required' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureSheetExists(sheets, spreadsheetId, STOCKS_TAB);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(STOCKS_TAB)}!A:D`,
    });

    const rows = res.data.values || [];
    const dataRows = rows.slice(1);

    const stocks: Record<number, number> = {};
    for (const r of dataRows) {
      const [loc, pid, qty] = r;
      if (loc === location && pid) {
        stocks[Number(pid)] = Number(qty) || 0;
      }
    }

    return NextResponse.json({ location, stocks });
  } catch (e: any) {
    console.error('GET /api/stocks error', e?.message || e);
    return NextResponse.json({ error: 'failed to fetch stocks' }, { status: 500 });
  }
}
