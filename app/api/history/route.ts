import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  fetchHistory,
  toBangkokDateString,
  listLocationIds,
  type HistoryRow,
} from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ALL').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const validIds = await listLocationIds(sheets, spreadsheetId);

    if (location !== 'ALL') {
      if (!validIds.includes(location)) {
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
      }
      const { rows, totals } = await fetchHistory(spreadsheetId, location, date);
      return NextResponse.json({ rows, totals }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Case ALL: Combined logic
    const results = await Promise.all(
      validIds.map(async (loc) => {
        const { rows, totals } = await fetchHistory(spreadsheetId, loc, date);
        const tagged = (rows as HistoryRow[]).map(r => ({ ...r, location: loc }));
        return { rows: tagged, totals };
      })
    );

    const allRows = results.flatMap(r => r.rows);
    const grand = results.reduce((acc, cur) => {
      acc.count += cur.totals.count ?? 0;
      acc.totalQty += cur.totals.totalQty ?? 0;
      acc.totalAmount += cur.totals.totalAmount ?? 0;
      acc.freebiesAmount += cur.totals.freebiesAmount ?? 0;
      for (const [k, v] of Object.entries(cur.totals.byPayment || {})) {
        acc.byPayment[k] = (acc.byPayment[k] || 0) + (v as number);
      }
      return acc;
    }, { count: 0, totalQty: 0, totalAmount: 0, freebiesAmount: 0, byPayment: {} as Record<string, number> });

    return NextResponse.json(
      { rows: allRows, totals: grand, location: 'ALL', date },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('GET /api/history error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
