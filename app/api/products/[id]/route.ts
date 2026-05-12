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

export async function PUT(req: Request, context: any) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const { id } = (context?.params ?? {}) as { id?: string };
    const idNum = parseNum(id);

    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }

    // Get the full body from frontend
    const { name, price, category, active } = await req.json();

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Read the sheet to find the row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:E`, // Adjusted range to include Category if exists
    });
    
    const values = res.data.values ?? [];
    let rowIndex = values.findIndex(row => parseNum(row[0]) === idNum);

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 2. Map the data to columns
    // A: ID, B: Name, C: Price, D: Category, E: Active
    // We update B through E for the specific row (rowIndex + 1 for 1-based index)
    const rowNumber = rowIndex + 1;
    const range = `${PRODUCTS_TAB}!B${rowNumber}:E${rowNumber}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          name, 
          price, 
          category || '', 
          active ? 'TRUE' : 'FALSE'
        ]],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PUT /api/products/[id] error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
