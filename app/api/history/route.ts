// app/api/history/route.ts
import { NextResponse } from 'next/server';
import { ALLOWED_TABS, fetchHistory, toBangkokDateString } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    if (!ALLOWED_TABS.has(location)) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

    const data = await fetchHistory(spreadsheetId, location, date);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/history error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
