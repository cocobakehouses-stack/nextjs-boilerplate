// app/api/history/csv/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  ALLOWED_TABS,
  fetchHistory,
  toBangkokDateString,
  getAuth,
  ensureSheetExists,
  type HistoryRow,
} from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOC_TAB = 'Locations'; // A: ID, B: Label

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

    // header: ถ้า ALL จะเพิ่มคอลัมน์ Location
    const header = location === 'ALL'
      ? ['Location','Date','Time','BillNo','Items','Freebies','TotalQty','Payment','Total','FreebiesAmount']
      : ['Date','Time','BillNo','Items','Freebies','TotalQty','Payment','Total','FreebiesAmount'];

    let lines: string[] = [];

    if (location === 'ALL') {
      const ids = await listLocationIds(spreadsheetId);
      const merged: HistoryRow[] = [];
      for (const id of ids) {
        const { rows } = await fetchHistory(spreadsheetId, id, date);
        const list = (rows as HistoryRow[]).map(r => ({ ...r, location: id }));
        merged.push(...list);
      }
      // แปลงเป็น CSV
      lines = merged.map(r => ([
        r.location || '',
        r.date || '',
        r.time || '',
        r.billNo || '',
        JSON.stringify(r.items || ''),
        JSON.stringify(r.freebies || ''),
        String(r.totalQty ?? 0),
        r.payment || '',
        (r.total ?? 0).toFixed(2),
        (r.freebiesAmount ?? 0).toFixed(2),
      ].join(',')));
    } else {
      const { rows } = await fetchHistory(spreadsheetId, location, date);
      const list = rows as HistoryRow[];
      lines = list.map(r => ([
        r.date || '',
        r.time || '',
        r.billNo || '',
        JSON.stringify(r.items || ''),
        JSON.stringify(r.freebies || ''),
        String(r.totalQty ?? 0),
        r.payment || '',
        (r.total ?? 0).toFixed(2),
        (r.freebiesAmount ?? 0).toFixed(2),
      ].join(',')));
    }

    const csv = [header.join(','), ...lines].join('\n');
    const fileName = location === 'ALL'
      ? `EOD_ALL_${date}.csv`
      : `EOD_${location}_${date}.csv`;

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
