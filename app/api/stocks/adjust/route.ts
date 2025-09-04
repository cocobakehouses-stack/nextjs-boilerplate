// app/api/stocks/adjust/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExists, TZ } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';
const MOVEMENTS_TAB = 'MOVEMENTS';

function a1Sheet(title: string) {
  return `'${String(title).replace(/'/g, "''")}'`;
}
function nowDateTimeBangkok() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(now).replace(/\./g, ':');
  return { date, time, iso: now.toISOString() };
}

type Movement = {
  productId: number;
  delta: number;   // + รับเข้า / - ขายออก
  reason?: string; // sale, restock, adjust
  billNo?: string;
};
type Body = {
  location: string;
  movements: Movement[];
};

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.location || !body.movements?.length) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ensure tabs exist
    await ensureSheetExists(sheets, spreadsheetId, STOCKS_TAB, ['locationId','productId','qty','updatedAt']);
    await ensureSheetExists(sheets, spreadsheetId, MOVEMENTS_TAB, ['date','time','locationId','productId','delta','reason','billNo']);

    // โหลด STOCKS ปัจจุบัน
    const stockRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(STOCKS_TAB)}!A:D`,
    });
    const rows = stockRes.data.values || [];
    const header = rows[0] || [];
    const dataRows = rows.slice(1);

    const stockMap: Record<string, { rowIndex: number; qty: number }> = {};
    dataRows.forEach((r, i) => {
      const [loc, pid, qty] = r;
      const key = `${loc}_${pid}`;
      stockMap[key] = { rowIndex: i + 2, qty: Number(qty) || 0 };
    });

    // คำนวณปรับ
    const { date, time, iso } = nowDateTimeBangkok();
    const updates: { rowIndex: number; values: any[] }[] = [];
    const appendRows: any[][] = [];

    for (const m of body.movements) {
      const key = `${body.location}_${m.productId}`;
      const cur = stockMap[key];
      let newQty = (cur?.qty || 0) + m.delta;
      if (newQty < 0) newQty = 0; // ไม่ให้ติดลบ

      if (cur) {
        updates.push({
          rowIndex: cur.rowIndex,
          values: [body.location, m.productId, newQty, iso],
        });
        stockMap[key].qty = newQty;
      } else {
        // append row ใหม่ใน STOCKS
        updates.push({
          rowIndex: dataRows.length + updates.length + 2,
          values: [body.location, m.productId, newQty, iso],
        });
      }

      // append ลง MOVEMENTS
      appendRows.push([
        date, time, body.location, m.productId,
        m.delta, m.reason || '', m.billNo || '',
      ]);
    }

    // เขียนกลับ STOCKS
    for (const u of updates) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${a1Sheet(STOCKS_TAB)}!A${u.rowIndex}:D${u.rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [u.values] },
      });
    }

    // append MOVEMENTS
    if (appendRows.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${a1Sheet(MOVEMENTS_TAB)}!A:G`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: appendRows },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/stocks/adjust error', e?.message || e);
    return NextResponse.json({ error: 'adjust failed' }, { status: 500 });
  }
}
