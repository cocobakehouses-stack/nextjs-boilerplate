import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export async function POST(req: Request) {
  try {
    const { billNo, location } = await req.json();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Find the bill in the sheet
    // Assuming BillNo is in Column C (adjust index if necessary)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${location}!A:Z`, 
    });

    const rows = response.data.values || [];
    // Search for the row with the matching BillNo
    // Index 2 is Column C. Change this if your BillNo is in a different column.
    const rowIndex = rows.findIndex(row => row[2] === String(billNo));

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // 2. Mark as VOID
    // Assuming Column L (index 11) is your "Status" or "Note" column
    // Google Sheets API uses 1-based indexing for ranges, so rowIndex + 1
    const updateRange = `${location}!L${rowIndex + 1}`; 

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['VOIDED']],
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Void Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
