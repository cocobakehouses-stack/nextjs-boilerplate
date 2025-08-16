// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Line = { name: string; qty: number; price: number };
type Body = {
  location: string;                 // เช่น 'FLAGSHIP' | 'SINDHORN' | 'CHIN3'
  billNo?: string;                  // ถ้าไม่ส่งมา จะ auto-generate เป็น 01,02,... ต่อวัน/สาขา
  date?: string;                    // 'YYYY-MM-DD' (ไม่ส่งมาก็ใช้เวลาปัจจุบัน Asia/Bangkok)
  time?: string;                    // 'HH:MM' หรือ 'HH:MM:SS' (ไม่ส่งมาก็ใช้เวลาปัจจุบัน)
  payment: 'cash' | 'promptpay';
  items: Line[];                    // สินค้าทั้งหมด (รวมของแถมในจำนวนชิ้นด้วยก็ได้)
  freebies?: Line[];                // ถ้าไม่มีของแถม ให้ส่ง [] หรือเว้นไว้
  total: number;                    // ยอดสุทธิหลังหักของแถมแล้ว
};

const TZ = 'Asia/Bangkok';
const ALLOWED_TABS = new Set(['FLAGSHIP', 'SINDHORN', 'CHIN3', 'ORDERS']);

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const key = keyRaw.includes('\\n') ? keyRaw.replace(/\\n/g, '\n') : keyRaw;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.JWT(email, undefined, key, scopes);
}

function nowDateTimeBangkok() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now).replace(/\./g, ':');
  return { date, time };
}

function normalizeTime(t?: string) {
  if (!t) return undefined;
  // HH:MM → เติม :00
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  return undefined;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets ?? []).some((s: any) => s.properties?.title === title);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  // ใส่ header ตามรูปแบบเดิม
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1:H1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[ 'Date','Time','BillNo','Items','Freebies','TotalQty','Payment','Total' ]],
    },
  });
}

// อ่านบิลของวันนั้นในแท็บ location แล้วให้เลขถัดไป (01,02,...)
async function getNextBillNoForDate(
  sheets: any,
  spreadsheetId: string,
  title: string,
  date: string
) {
  // อ่านคอลัมน์ A:C (Date, Time, BillNo)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A:C`,
  });
  const rows = res.data.values || [];
  const dataRows = rows.slice(1); // skip header

  let maxNo = 0;
  for (const r of dataRows) {
    const rowDate = r[0]; // A: Date
    const bill = (r[2] || '').toString().trim(); // C: BillNo
    if (rowDate === date && bill) {
      const num = parseInt(bill, 10); // ถ้าเก็บ 01/02 ก็ parse ได้
      if (!isNaN(num) && num > maxNo) maxNo = num;
    }
  }
  return pad2(maxNo + 1);
}

export async function POST(req: Request) {
  try {
    const {
      location,
      billNo,
      date,
      time,
      payment,
      items,
      freebies = [],
      total,
    } = (await req.json()) as Body;

    if (!location || !items?.length || !payment || typeof total !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const tabTitle = (location || 'ORDERS').toUpperCase();
    if (!ALLOWED_TABS.has(tabTitle)) {
      return NextResponse.json({ error: 'Invalid location/tab' }, { status: 400 });
    }

    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    // วันที่/เวลา (ถ้าไม่ส่งมา ใช้ปัจจุบันโซนไทย)
    let useDate = date;
    let useTime = normalizeTime(time);
    if (!useDate || !/^\d{4}-\d{2}-\d{2}$/.test(useDate)) {
      useDate = nowDateTimeBangkok().date;
    }
    if (!useTime) {
      useTime = nowDateTimeBangkok().time;
    }

    // สร้างแท็บถ้ายังไม่มี
    await ensureSheetExists(sheets, spreadsheetId, tabTitle);

    // ถ้าไม่ส่ง billNo มา → หาเลขล่าสุดของวันนั้นในแท็บนี้ แล้ว +1 (01,02,...)
    let useBillNo = (billNo ?? '').trim();
    if (!useBillNo) {
      useBillNo = await getNextBillNoForDate(sheets, spreadsheetId, tabTitle, useDate);
    }

    const itemsText = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const freebiesText = (freebies ?? []).map(f => `${f.name} x${f.qty}`).join('; ');
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabTitle}!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          useDate,                    // A: Date
          useTime,                    // B: Time
          useBillNo,                  // C: BillNo (รีเซ็ตแต่ละวัน)
          itemsText,                  // D: Items
          freebiesText,               // E: Freebies (ว่างได้)
          String(totalQty),           // F: TotalQty (รวมของแถมด้วย)
          payment,                    // G: Payment
          Number(total).toFixed(2),   // H: Total (หลังหักของแถม)
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
      },
    });
  } catch (e: any) {
    console.error('POST /api/orders -> Sheets error', e?.message || e);
    return NextResponse.json({ error: 'Sheets write failed' }, { status: 500 });
  }
}
