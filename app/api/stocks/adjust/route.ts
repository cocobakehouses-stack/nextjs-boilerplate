// app/api/stocks/adjust/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  ensureSheetExistsIdempotent, // ✅ ใช้แบบ idempotent
} from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';

function a1(title: string) {
  return `'${String(title).replace(/'/g, "''")}'`;
}
function todayTH() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}
function timeTH() {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(/\./g, ':');
}

export async function PATCH(req: Request) {
  try {
    const { location, movements } = await req.json();
    if (!location || !Array.isArray(movements) || movements.length === 0) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ ให้แน่ใจว่ามี STOCKS แบบไม่เพิ่มซ้ำ (กัน addSheet ซ้ำ)
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, STOCKS_TAB);

    const date = todayTH();
    const time = timeTH();

    // เตรียมแถวเพิ่ม (A..H = Date,Time,Location,ProductId,ProductName,Delta,Reason,User)
    const values = movements.map((m: any) => ([
      date,
      time,
      String(location).toUpperCase(),
      Number(m.productId) || 0,
      m.productName || '',
      Number(m.delta) || 0,
      m.reason || 'manual adjust',
      m.user || '',
    ]));

    // append
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${a1(STOCKS_TAB)}!A:H`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    return NextResponse.json({ ok: true, added: values.length });
  } catch (e: any) {
    console.error('PATCH /api/stocks/adjust error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
