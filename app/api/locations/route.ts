import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExists } from '@/app/lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTRY_TAB = 'Locations';
const ID_PATTERN = /^[A-Z0-9_]+$/; // ไม่มีเว้นวรรค/พิเศษ และเป็น CAPS

async function listLocations(spreadsheetId: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  // ให้มีแท็บ registry เสมอ
  await ensureSheetExists(sheets, spreadsheetId, REGISTRY_TAB);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REGISTRY_TAB}!A:B`,
  });
  const rows = (res.data.values || []).slice(1);
  return rows
    .filter(r => (r[0] || '').trim())
    .map(r => ({ id: (r[0] || '').trim(), label: (r[1] || '').trim() || r[0] }));
}

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const data = await listLocations(spreadsheetId);
    return NextResponse.json({ locations: data });
  } catch (e: any) {
    console.error('GET /api/locations error', e?.message || e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const { id, label } = await req.json();

    if (!id || !label) {
      return NextResponse.json({ error: 'id and label are required' }, { status: 400 });
    }
    const normId = String(id).trim().toUpperCase();
    if (!ID_PATTERN.test(normId)) {
      return NextResponse.json({ error: 'Invalid ID. Use A–Z, 0–9, _ only (no spaces).' }, { status: 400 });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1) ensure registry exists
    await ensureSheetExists(sheets, spreadsheetId, REGISTRY_TAB);
    // 2) check duplicate in registry
    const current = await listLocations(spreadsheetId);
    if (current.some(l => l.id === normId)) {
      return NextResponse.json({ error: 'This ID already exists' }, { status: 409 });
    }
    // 3) append into registry
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${REGISTRY_TAB}!A:B`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[normId, String(label).trim()]] },
    });
    // 4) create the new location tab (with headers A–H แบบที่ใช้อยู่)
    await ensureSheetExists(sheets, spreadsheetId, normId);

    return NextResponse.json({ ok: true, id: normId, label: String(label).trim() });
  } catch (e: any) {
    console.error('POST /api/locations error', e?.message || e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
