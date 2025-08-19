// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  ALLOWED_TABS,
  getAuth,
  ensureSheetExists,
  toBangkokDateString,
} from '@/app/lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Line = { name: string; qty: number; price: number };
type Body = {
  location: string;                 // เช่น 'FLAGSHIP' | 'SINDHORN' | 'CHIN3'
  billNo?: string;                  // ไม่ส่งมา → auto 01,02,… ต่อวัน/สาขา
  date?: string;                    // 'YYYY-MM-DD'
  time?: string;                    // 'HH:MM' หรือ 'HH:MM:SS'
  payment: 'cash' | 'promptpay';
  items: Line[];
  freebies?: Line[];
  total: number;                    // ยอดสุทธิหลังหักของแถมแล้ว
};

const TZ = 'Asia/Bangkok';

function normalizeTime(t?: string) {
  if (!t) return undefined;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  return undefined;
}
function nowTimeBangkok() {
  const now = new Date();
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now).replace(/\./g, ':');
}
function pad2(n: number) {
  return String(n).padStart(2, '0');
}

async function getNextBillNoForDate(
  sheets: any, spreadsheetId: string, title: string, date: string
) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:C` });
  const rows: string[][] = res.data.values || [];
  let maxNo = 0;
  for (const r of rows.slice(1)) {
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
    const body = (await req.json()) as Body;
    const {
      location,
      billNo,
      date,
      time,
      payment,
      items,
      freebies = [],
      total,
    } = body;

    if (!location || !items?.length || !payment || typeof total !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const tabTitle = (location || 'ORDERS').toUpperCase();
    if (!ALLOWED_TABS.has(tabTitle)) {
      return NextResponse.json({ error: 'Invalid location/tab' }, { status: 400 });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    // ให้มีหัวตาราง A:I (เพิ่มคอลัมน์ I: FreebiesAmount)
    await ensureSheetExists(sheets, spreadsheetId, tabTitle);

    // วันที่/เวลา
    const useDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? (date as string) : toBangkokDateString();
    const useTime = normalizeTime(time) ?? nowTimeBangkok();

    // หา bill ถ้าไม่ส่งมา
    let useBillNo = (billNo ?? '').trim();
    if (!useBillNo) useBillNo = await getNextBillNoForDate(sheets, spreadsheetId, tabTitle, useDate);

    // เขียนคอลัมน์
    const itemsText = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const freebiesText = (freebies ?? []).map(f => `${f.name} x${f.qty}`).join('; ');
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);

    // ⬅️ NEW: รวมยอดของแถม (ราคา * จำนวน)
    const freebiesAmount = (freebies ?? []).reduce((s, f) => s + (Number(f.price) || 0) * (Number(f.qty) || 0), 0);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabTitle}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          useDate,                      // A: Date
          useTime,                      // B: Time
          useBillNo,                    // C: BillNo
          itemsText,                    // D: Items
          freebiesText,                 // E: Freebies
          String(totalQty),             // F: TotalQty
          payment,                      // G: Payment
          Number(total).toFixed(2),     // H: Total (หลังหักแถม)
          Number(freebiesAmount).toFixed(2), // I: FreebiesAmount  ⬅️ NEW
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
        freebiesAmount: Number(freebiesAmount).toFixed(2),
        tab: tabTitle,
      },
    });
  } catch (e: any) {
    console.error('POST /api/orders -> Sheets error', e?.message || e);
    return NextResponse.json({ error: 'Sheets write failed' }, { status: 500 });
  }
}
