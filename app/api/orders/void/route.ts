import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../../lib/sheets';

export async function POST(req: Request) {
  try {
    const { billNo, location } = await req.json();
    if (!billNo || !location) return NextResponse.json({ error: 'Missing billNo or location' }, { status: 400 });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Fetch Columns A through C to find the BillNo (which is in C)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${location}!A:C`, 
    });

    const rows = response.data.values || [];
    
    // Search Column C (index 2) for the matching BillNo string
    const rowIndex = rows.findIndex(row => String(row[2]).trim() === String(billNo).trim());

    if (rowIndex === -1) {
      return NextResponse.json({ error: `Bill #${billNo} not found in ${location}` }, { status: 404 });
    }

    // 2. Get the Sheet ID for the target location
    const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = sheetInfo.data.sheets?.find(s => s.properties?.title === location);
    
    if (!sheet) return NextResponse.json({ error: 'Location sheet not found' }, { status: 404 });
    const sheetId = sheet.properties?.sheetId;

    // 3. Execute the deletion
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
    console.error("Void Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
