// app/api/history/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  ALLOWED_TABS,
  fetchHistory,
  toBangkokDateString,
  getAuth,
  ensureSheetExists,
  type HistoryRow,
} from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOC_TAB = 'Locations';

async function listLocationIds(spreadsheetId: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureSheetExists(sheets, spreadsheetId, LOC_TAB);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${LOC_TAB}!A:A` });
  const rows = (r.data.values || []).slice(1);
  return rows.map(x => (x?.[0] || '').toString().trim().toUpperCase()).filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    if (location !== 'ALL' && !ALLOWED_TABS.has(location)) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

    // สาขาเดียว → คืน rows/totals จาก fetchHistory ตามเดิม
    if (location !== 'ALL') {
      const { rows, totals } = await fetchHistory(spreadsheetId, location, date);
      return NextResponse.json({ rows, totals }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ALL → รวมทุกสาขา
    const ids = await listLocationIds(spreadsheetId);
    let merged: HistoryRow[] = [];
    for (const id of ids) {
      const { rows } = await fetchHistory(spreadsheetId, id, date);
      const list = (rows as HistoryRow[]).map(r => ({ ...r, location: id }));
      merged.push(...list);
    }
    // sort เวลา
    merged.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    // รวม totals
    const totals = {
      count: merged.length,
      totalQty: merged.reduce((s, r) => s + (r.totalQty || 0), 0),
      totalAmount: merged.reduce((s, r) => s + (r.total || 0), 0),
      freebiesAmount: merged.reduce((s, r) => s + (r.freebiesAmount || 0), 0),
      byPayment: merged.reduce((acc, r) => {
        const k = r.payment || '-';
        acc[k] = (acc[k] || 0) + (r.total || 0);
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({ rows: merged, totals }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/history error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
