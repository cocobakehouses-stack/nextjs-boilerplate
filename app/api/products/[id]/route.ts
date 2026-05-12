import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export const runtime = 'nodejs';
const PRODUCTS_TAB = 'Products';

// Helper to parse IDs safely
function parseNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/** ---------- PUT: Full Update ---------- */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // <--- CRITICAL: Must await in Next.js 15
    const idNum = parseNum(id);
    const { name, price, category, active } = await req.json();

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCTS_TAB}!A:A` });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => parseNum(r[0]) === idNum);

    if (rowIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rowNumber = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!B${rowNumber}:E${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[name, price, category, active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** ---------- DELETE: Remove Row ---------- */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // <--- CRITICAL: Must await in Next.js 15
    const idNum = parseNum(id);
    
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCTS_TAB}!A:A` });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => parseNum(r[0]) === idNum);

    if (rowIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A${rowIndex + 1}:E${rowIndex + 1}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** ---------- PATCH: Quick Toggle ---------- */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const idNum = parseNum(id);
    const { active } = await req.json();

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCTS_TAB}!A:A` });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => parseNum(r[0]) === idNum);

    if (rowIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!E${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
