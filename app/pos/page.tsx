// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExists } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Line = { name: string; qty: number; price: number };
type Body = {
  location: string;
  billNo?: string;
  date?: string;
  time?: string;
  payment: 'cash' | 'promptpay';
  items: Line[];
  freebies?: Line[];
  total: number;
};

const TZ = 'Asia/Bangkok';

function nowDateTimeBangkok() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now).replace(/\./g, ':');
  return { date, time };
}
function normalizeTime(t?: string) {
  if (!t) return undefined;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  return undefined;
}
function pad2(n: number) { return String(n).padStart(2, '0'); }

async function getNextBillNoForDate(sheets: any, spreadsheetId: string, title: string, date: string) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:C` });
  const rows = res.data.values || [];
  const dataRows = rows.slice(1);

  let maxNo = 0;
  for (const r of dataRows) {
    const rowDate = r[0];
    const bill = (r[2] || '').toString().trim();
    if (rowDate === date && bill) {
      const num = parseInt(bill, 10);
      if (!isNaN(num) && num > maxNo) maxNo = num;
    }
  }
  return pad2(maxNo + 1);
}

export async function POST(req: Request) {
  try {
    const { location, billNo, date, time, payment, items, freebies = [], total } = (await req.json()) as Body;

    if (!location || !items?.length || !payment || typeof total !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ ใช้ location เป็นชื่อแท็บ (uppercase) และ "สร้างแท็บอัตโนมัติ" เสมอหากยังไม่มี
    const tabTitle = (location || 'ORDERS').toUpperCase();
    await ensureSheetExists(sheets, spreadsheetId, tabTitle); // จะสร้างพร้อมหัวคอลัมน์ A..I ถ้ายังไม่มี

    // วันเวลา + เลขบิล
    const { date: today, time: now } = nowDateTimeBangkok();
    const useDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
    const useTime = normalizeTime(time) || now;
    let useBillNo = (billNo ?? '').trim();
    if (!useBillNo) useBillNo = await getNextBillNoForDate(sheets, spreadsheetId, tabTitle, useDate);

    // เตรียมข้อความ + ค่ารวม
    const itemsText = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const freebiesText = (freebies ?? []).map(f => `${f.name} x${f.qty}`).join('; ');
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);
    const freebiesValue = (freebies ?? []).reduce((s, f) => s + (Number(f.price) || 0) * (Number(f.qty) || 0), 0);

    // บันทึกลงชีต (รวม I: FreebiesAmount)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabTitle}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          useDate,                        // A: Date
          useTime,                        // B: Time
          useBillNo,                      // C: BillNo
          itemsText,                      // D: Items
          freebiesText,                   // E: Freebies
          String(totalQty),               // F: TotalQty
          payment,                        // G: Payment
          Number(total).toFixed(2),       // H: Total
          Number(freebiesValue).toFixed(2)// I: FreebiesAmount
        ]],
      },
    });

    return NextResponse.json({
      ok: true,
      saved: {
        date: useDate,
        time: useTime,
        billNo: useBillNo,
        payment,
        total: Number(total).toFixed(2),
        tab: tabTitle,
        freebiesAmount: freebiesValue,
      },
    });
  } catch (e: any) {
    console.error('POST /api/orders -> Sheets error', e?.message || e);
    return NextResponse.json({ error: 'Sheets write failed' }, { status: 500 });
  }
}