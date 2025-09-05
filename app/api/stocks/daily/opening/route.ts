// app/api/stocks/daily/opening/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetWithHeaders, TZ } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAILY_TAB = 'DAILY_STOCKS'; // schema: date,locationId,productId,openingQty,closingQty,snapshotAt

function a1(title: string) { return `'${String(title).replace(/'/g, "''")}'`; }
function toDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

type OpeningPayload = {
  location: string;
  date: string; // YYYY-MM-DD
  items: Array<{ productId: number; openingQty: number }>;
};

// GET /api/stocks/daily/opening?location=XX&date=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').toUpperCase();
    const date = url.searchParams.get('date') || toDate();

    if (!location) return NextResponse.json({ error: 'location required' }, { status: 400 });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });

    await ensureSheetWithHeaders(sheets, spreadsheetId, DAILY_TAB, [
      'date','locationId','productId','openingQty','closingQty','snapshotAt'
    ]);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1(DAILY_TAB)}!A:F`,
    });
    const rows = res.data.values || [];
    const data = rows.slice(1).filter(r => r[0] === date && (r[1]||'').toUpperCase() === location);

    const map: Record<number, number> = {};
    for (const r of data) {
      const pid = Number(r[2]); const opening = Number(r[3])||0;
      map[pid] = opening;
    }
    return NextResponse.json({ date, location, opening: map }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (e:any) {
    console.error('GET /daily/opening', e?.message||e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

// PUT /api/stocks/daily/opening
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as OpeningPayload;
    const location = (body?.location || '').toUpperCase();
    const date = body?.date || toDate();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!location || !items.length) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });

    await ensureSheetWithHeaders(sheets, spreadsheetId, DAILY_TAB, [
      'date','locationId','productId','openingQty','closingQty','snapshotAt'
    ]);

    // โหลดทั้งหมดก่อน เพื่อง่ายต่อ upsert
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${a1(DAILY_TAB)}!A:F`,
    });
    const rows = res.data.values || [];
    const header = rows[0] || [];
    const dataRows = rows.slice(1);

    // สร้าง index สำหรับแถวที่มี (date, location, pid)
    const index: Record<string, number> = {};
    dataRows.forEach((r, i) => {
      const key = `${r[0]}|${(r[1]||'').toUpperCase()}|${r[2]}`;
      index[key] = i + 2; // a1 row index
    });

    // เขียนกลับแบบ batch: update หรือ append
    const updates: Array<{ row: number; values: any[] }> = [];
    const appends: any[][] = [];

    for (const it of items) {
      const pid = Number(it.productId);
      const opening = Math.max(0, Number(it.openingQty)||0);
      const key = `${date}|${location}|${pid}`;
      const values = [date, location, pid, opening, '', ''];

      if (index[key]) {
        // update row
        updates.push({ row: index[key], values });
      } else {
        // append row
        appends.push(values);
      }
    }

    for (const u of updates) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${a1(DAILY_TAB)}!A${u.row}:F${u.row}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [u.values] },
      });
    }
    if (appends.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${a1(DAILY_TAB)}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: appends },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    console.error('PUT /daily/opening', e?.message||e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
