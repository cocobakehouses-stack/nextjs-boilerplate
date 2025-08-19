// app/api/locations/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExists } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCATIONS_TAB = 'Locations'; // A: ID, B: Label

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ensure Locations tab
    await ensureSheetExists(sheets, spreadsheetId, LOCATIONS_TAB);
    // set header if empty
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${LOCATIONS_TAB}!A1:B1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['ID','Label']] },
    });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${LOCATIONS_TAB}!A:B`
    });
    const rows = (res.data.values || []).slice(1);
    const locations = rows
      .map(r => ({ id: (r[0]||'').toString().trim().toUpperCase(), label: (r[1]||'').toString().trim() }))
      .filter(r => r.id && r.label);

    return NextResponse.json({ locations }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/locations error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, label } = await req.json();
    const normId = (id || '').toString().trim().toUpperCase();
    const normLabel = (label || '').toString().trim();
    if (!/^[A-Z0-9_]+$/.test(normId) || !normLabel) {
      return NextResponse.json({ error: 'Invalid id/label' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ensure Locations tab + append
    await ensureSheetExists(sheets, spreadsheetId, LOCATIONS_TAB);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${LOCATIONS_TAB}!A:B`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[normId, normLabel]] },
    });

    // ensure new location sheet
    await ensureSheetExists(sheets, spreadsheetId, normId);

    return NextResponse.json({ ok: true, id: normId, label: normLabel });
  } catch (e: any) {
    console.error('POST /api/locations error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
