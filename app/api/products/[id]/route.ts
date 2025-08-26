// app/api/products/[id]/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'Products';

async function ensureProductsSheetExists(sheets: any, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const exists = (meta.data.sheets ?? []).some(
    (s: any) => s.properties?.title === PRODUCTS_TAB
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: PRODUCTS_TAB } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['ID', 'Name', 'Price', 'Active']] },
    });
  }
}

function parseNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Missing GOOGLE_SHEETS_ID' }, { status: 500 });
    }

    const idNum = parseNum(ctx.params.id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const active = body?.active;
    if (typeof active !== 'boolean') {
      return NextResponse.json({ error: 'active must be boolean' }, { status: 400 });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    // หา row ของ product id
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
    });
    const values: string[][] = res.data.values || [];
    // header อยู่แถว 1 → data เริ่ม index 1
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      const v = parseNum(values[i]?.[0]);
      if (v === idNum) {
        rowIndex = i; // zero-based index ใน values
        break;
      }
    }
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // คอลัมน์ D = Active → แถวจริงในชีต = rowIndex + 1 (เพราะ header 1 แถว + index เริ่ม 0)
    const sheetRow = rowIndex + 1; // header=1 → data row เริ่ม 2 → index1=2, index2=3, ...
    const range = `${PRODUCTS_TAB}!D${sheetRow + 1}:D${sheetRow + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/products/[id] error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
