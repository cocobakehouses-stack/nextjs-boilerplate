import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRODUCTS_TAB = 'Products';

function parseNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

// --- PATCH: For the quick toggle (Keeping it as it was) ---
export async function PATCH(req: Request, context: any) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const { id } = (context?.params ?? {}) as { id?: string };
    const idNum = parseNum(id);
    const { active } = await req.json();

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCTS_TAB}!A:A` });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => parseNum(row[0]) === idNum);

    if (rowIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Update only Column E (Active) - Assuming A:ID, B:Name, C:Price, D:Category, E:Active
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!E${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

// --- PUT: For the "Save Edit" button (Name, Price, Category) ---
export async function PUT(req: Request, context: any) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const { id } = (context?.params ?? {}) as { id?: string };
    const idNum = parseNum(id);
    const { name, price, category, active } = await req.json();

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCTS_TAB}!A:A` });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => parseNum(row[0]) === idNum);

    if (rowIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Update B:E (Name, Price, Category, Active)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!B${rowIndex + 1}:E${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[name, price, category || '', active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
