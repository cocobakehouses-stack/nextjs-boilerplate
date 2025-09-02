import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, ensureSheetExists, TZ } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Line = { name: string; qty: number; price: number };
type Body = {
  location: string;
  billNo?: string;
  date?: string;
  time?: string;
  payment: 'cash' | 'promptpay' | 'lineman';
  items: Line[];
  freebies?: Line[];

  // ฟิลด์จากฝั่ง POS
  subtotal?: number;
  freebiesAmount?: number;
  linemanMarkup?: number;
  discount?: number;   // ✅ ใช้กับทุกวิธีจ่าย

  total: number; // ยอดสุดท้าย
};

// escape tab name
function a1Sheet(title: string) {
  const escaped = String(title).replace(/'/g, "''");
  return `'${escaped}'`;
}

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
  const sheetRef = a1Sheet(title);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetRef}!A:C` });
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
    const {
      location, billNo, date, time, payment, items,
      freebies = [],
      subtotal: inSubtotal,
      freebiesAmount: inFreebiesAmount,
      linemanMarkup: inMarkup,
      discount: inDiscount,
      total: inTotal,
    } = (await req.json()) as Body;

    if (!location || !items?.length || !payment || typeof inTotal !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const tabTitle = (location || 'ORDERS').toUpperCase();
    await ensureSheetExists(sheets, spreadsheetId, tabTitle);

    const { date: today, time: now } = nowDateTimeBangkok();
    const useDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
    const useTime = normalizeTime(time) || now;

    let useBillNo = (billNo ?? '').trim();
    if (!useBillNo) useBillNo = await getNextBillNoForDate(sheets, spreadsheetId, tabTitle, useDate);

    const itemsText = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const freebiesText = (freebies ?? []).map(f => `${f.name} x${f.qty}`).join('; ');

    const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const freebiesAmountCalc = (freebies ?? []).reduce((s, f) => s + (Number(f.price) || 0) * (Number(f.qty) || 0), 0);

    const subtotal = Number.isFinite(inSubtotal as number)
      ? Number(inSubtotal)
      : items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);

    const freebiesAmount = Number.isFinite(inFreebiesAmount as number)
      ? Number(inFreebiesAmount)
      : freebiesAmountCalc;

    const linemanMarkup = Number.isFinite(inMarkup as number) ? Number(inMarkup) : 0;
    const discount = Number.isFinite(inDiscount as number) ? Number(inDiscount) : 0;

    // ถ้าฝั่ง client ไม่ส่ง total มา ให้คำนวณซ้ำเพื่อกันพลาด
    const computedTotal = Number((subtotal - freebiesAmount - discount + linemanMarkup).toFixed(2));
    const finalTotal = Number.isFinite(inTotal) ? Number(inTotal) : computedTotal;

    const sheetRef = a1Sheet(tabTitle);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetRef}!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          useDate,                 // A: Date
          useTime,                 // B: Time
          useBillNo,               // C: BillNo
          itemsText,               // D: Items
          freebiesText,            // E: Freebies
          String(totalQty),        // F: TotalQty
          payment,                 // G: Payment
          finalTotal.toFixed(2),   // H: Total
          freebiesAmount.toFixed(2), // I: FreebiesAmount
          subtotal.toFixed(2),     // J: Subtotal
          linemanMarkup.toFixed(2),// K: LinemanMarkup
          discount.toFixed(2),     // L: Discount (ทุกวิธีจ่าย)
        ]],
      },
    });

    return NextResponse.json({
      ok: true,
      saved: {
        date: useDate, time: useTime, billNo: useBillNo, payment, total: finalTotal,
        tab: tabTitle, freebiesAmount, subtotal, linemanMarkup, discount,
      },
    });
  } catch (e: any) {
    console.error('POST /api/orders -> Sheets error', e?.message || e);
    return NextResponse.json({ error: 'Sheets write failed' }, { status: 500 });
  }
}
