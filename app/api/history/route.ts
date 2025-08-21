// app/api/history/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, fetchHistory, toBangkokDateString } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    // auth + sheets client
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // fetch data
    const { history, totals } = await fetchHistory(sheets, spreadsheetId, location);

    // filter เฉพาะวันที่เลือก
    const rows = history.filter(r => r.date === date);

    return NextResponse.json({ rows, totals }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/history error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
