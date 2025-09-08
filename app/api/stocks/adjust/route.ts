// app/api/stocks/adjust/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  a1Sheet,
  ensureSheetExists,
  // ถ้ามี ensureSheetExistsIdempotent อยู่แล้วใน lib ให้ใช้ตัวนั้นแทนได้
  toBangkokDateString,
} from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ตั้งชื่อแท็บที่ใช้เก็บข้อมูล
const PRODUCTS_TAB = 'PRODUCTS';           // A:ID, B:Name, C:Price
const STOCKS_TAB   = 'STOCKS';             // A:Location, B:ProductId, C:ProductName, D:Qty
const MOVE_TAB     = 'STOCK_MOVEMENTS';    // A:Date, B:Time, C:Location, D:ProductId, E:ProductName, F:Delta, G:Reason, H:User

type AdjustItem = {
  productId: number;
  delta?: number;       // เพิ่ม/ลดตามจำนวน (เช่น +3, -2)
  setTo?: number;       // ตั้งค่าเป็นจำนวนคงเหลือใหม่ (ไม่ใช้ร่วมกับ delta)
  reason?: string;
};

function fmtTimeBangkok(d = new Date()) {
  // HH:mm:ss (24h) + เวลาไทย
  const t = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  return t.replace(/\./g, ':');
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const location = String(body?.location || '').trim().toUpperCase();
    const movements: AdjustItem[] = Array.isArray(body?.movements) ? body.movements : [];

    if (!location) {
      return NextResponse.json({ error: 'missing location' }, { status: 400 });
    }
    if (movements.length === 0) {
      return NextResponse.json({ error: 'no movements' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ให้มีแท็บที่ต้องใช้เสมอ (idempotent)
    await ensureSheetExists(sheets, spreadsheetId, PRODUCTS_TAB);
    await ensureSheetExists(sheets, spreadsheetId, STOCKS_TAB);
    await ensureSheetExists(sheets, spreadsheetId, MOVE_TAB);

    // ===== 1) อ่าน PRODUCTS -> map id -> name =====
    const prodRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(PRODUCTS_TAB)}!A:C`,
    });
    const prodRows = (prodRes.data.values || []).slice(1);
    const idToName = new Map<number, string>();
    for (const r of prodRows) {
      const id = Number(r?.[0]);
      const name = String(r?.[1] ?? '').trim();
      if (Number.isFinite(id) && name) idToName.set(id, name);
    }

    // ===== 2) โหลด STOCKS snapshot ปัจจุบัน -> สร้าง index =====
    const stockRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(STOCKS_TAB)}!A:D`,
    });
    const stockRows = (stockRes.data.values || []);
    // header guard
    if (stockRows.length === 0) {
      stockRows.push(['Location', 'ProductId', 'ProductName', 'Qty']);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${a1Sheet(STOCKS_TAB)}!A1:D1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [stockRows[0]] },
      });
    }

    // index: key = LOCATION#ID -> rowIndex (1-based in sheet)
    const index = new Map<string, number>();
    for (let i = 1; i < stockRows.length; i++) {
      const loc = String(stockRows[i]?.[0] ?? '').trim().toUpperCase();
      const pid = Number(stockRows[i]?.[1]);
      if (!loc || !Number.isFinite(pid)) continue;
      index.set(`${loc}#${pid}`, i + 1); // 1-based row number in sheet
    }

    // helper อ่าน qty ปัจจุบัน
    const getQty = (row: any[]): number => {
      const n = Number(String(row?.[3] ?? '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    // ===== 3) คำนวณ & เตรียมชุด update STOCKS =====
    // เก็บค่าที่จะเขียนกลับ: key -> { row, values[] }
    const stockUpserts: Array<{ row: number; values: [string, number, string, number] }> = [];

    for (const mv of movements) {
      const pid = Number(mv.productId);
      if (!Number.isFinite(pid)) continue;

      const key = `${location}#${pid}`;
      const name = idToName.get(pid) ?? `#${pid}`;
      const existingRowNum = index.get(key); // อาจ undefined ถ้ายังไม่มีแถว

      if (existingRowNum) {
        // มีอยู่แล้ว -> อ่านค่าเก่า/คำนวณใหม่
        const currentRow = stockRows[existingRowNum - 1] || [];
        const currentQty = getQty(currentRow);
        const next = typeof mv.setTo === 'number'
          ? Math.max(0, Math.floor(mv.setTo))
          : Math.max(0, currentQty + Math.floor(mv.delta || 0));

        stockUpserts.push({
          row: existingRowNum,
          values: [location, pid, name, next],
        });
      } else {
        // ยังไม่มี -> เพิ่มแถวใหม่ (qty = delta หรือ setTo)
        const next = typeof mv.setTo === 'number'
          ? Math.max(0, Math.floor(mv.setTo))
          : Math.max(0, Math.floor(mv.delta || 0));

        const newRowNum = stockRows.length + stockUpserts.length + 1;
        index.set(key, newRowNum);
        stockUpserts.push({
          row: newRowNum,
          values: [location, pid, name, next],
        });
      }
    }

    // เขียนกลับ STOCKS (เป็นครั้งละหลาย cell แบบ batch)
    if (stockUpserts.length > 0) {
      const data = stockUpserts.map(u => ({
        range: `${a1Sheet(STOCKS_TAB)}!A${u.row}:D${u.row}`,
        values: [u.values],
      }));
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data,
        },
      });
    }

    // ===== 4) เขียน MOVEMENTS log =====
    const now = new Date();
    const date = toBangkokDateString(now);
    const time = fmtTimeBangkok(now);

    const moveValues = movements.map(mv => {
      const pid = Number(mv.productId);
      const delta = typeof mv.setTo === 'number'
        ? Number(mv.setTo) // ถ้า setTo ให้บันทึกค่าที่ตั้ง (หรือจะบันทึก diff ก็ปรับได้)
        : Number(mv.delta || 0);

      const name = idToName.get(pid) ?? `#${pid}`;
      const reason = String(mv.reason || 'adjust').trim();
      const user = '-';
      return [date, time, location, pid, name, delta, reason, user];
    });

    if (moveValues.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${a1Sheet(MOVE_TAB)}!A:H`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: moveValues },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/stocks/adjust error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
