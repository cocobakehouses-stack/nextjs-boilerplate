import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export const runtime = 'nodejs';
const PRODUCTS_TAB = 'Products';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { name, price, category, active } = await req.json();
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCTS_TAB}!A:A` });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === params.id);

    if (rowIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Update B:E (Name, Price, Category, Active)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!B${rowIndex + 1}:E${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[name, price, category, active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCTS_TAB}!A:A` });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === params.id);

    if (rowIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // This "clears" the row content. 
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A${rowIndex + 1}:E${rowIndex + 1}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
