import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export async function POST(req: Request) {
  try {
    const { billNo, location } = await req.json();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Find the row index (BillNo is in Column C)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${location}!A:C`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => String(row[2]) === String(billNo));

    if (rowIndex === -1) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

    // 2. Update Column M (Index 12) to "VOIDED"
    // Row index is +1 because Sheets starts at 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${location}!M${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['VOIDED']] },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
