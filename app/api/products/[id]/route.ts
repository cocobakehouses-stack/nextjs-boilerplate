import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

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
      requestBody: { values: [['ID','Name','Price','Active']] },
    });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const productId = Number(params.id);
    const body = await req.json();
    const active = !!body.active;

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    // โหลดทั้งหมด
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
    });
    const all = (res.data.values || []);
    const header = all[0];
    const rows = all.slice(1);

    let updated = false;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (Number(r?.[0]) === productId) {
        const rowIndex = i + 2; // +1 header, +1 base
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${PRODUCTS_TAB}!D${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[active ? 'TRUE' : 'FALSE']] },
        });
        updated = true;
        break;
      }
    }

    return NextResponse.json({ ok: updated });
  } catch (e: any) {
    console.error('PATCH /api/products/[id] error', e?.message || e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
