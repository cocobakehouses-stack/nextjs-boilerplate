import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export async function POST(req: Request) {
  try {
    const { billNo, location } = await req.json();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Find the row index by searching for the BillNo in the specific tab
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${location}!A:C`, // Adjust column range to where your BillNo is
    });

    const rows = response.data.values || [];
    // Assuming BillNo is in the first column (index 0)
    const rowIndex = rows.findIndex(row => row[0] === String(billNo));

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // 2. Delete the row
    // Note: Google Sheets API uses 0-based index for gridId but row index is specific
    const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = sheetInfo.data.sheets?.find(s => s.properties?.title === location)?.properties?.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
