// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------- Types ----------
type Line = { name: string; qty: number; price: number };
type Body = {
  location: string;                 // 'FLAGSHIP' | 'SINDHORN' | 'CHIN3' (ต้องมีแท็บชื่อนี้)
  billNo?: string;                  // ไม่ส่งมา -> ระบบออก 01,02,... ต่อวัน/สาขา
  date?: string;                    // 'YYYY-MM-DD' (ไม่ส่งจะใช้เวลาปัจจุบัน Asia/Bangkok)
  time?: string;                    // 'HH:MM' หรือ 'HH:MM:SS' (ไม่ส่งจะใช้เวลาปัจจุบัน)
  payment: 'cash' | 'promptpay';
  items: Line[];                    // สินค้าทั้งหมดในบิล (ไม่นับของแถม)
  freebies?: Line[];                // ของแถม (ถ้ามี)
  total: number;                    // ยอดสุทธิ (หลังหักของแถมแล้ว)
};

// ---------- Consts ----------
const TZ = 'Asia/Bangkok';
const ALLOWED_TABS = new Set(['FLAGSHIP', 'SINDHORN', 'CHIN3', 'ORDERS']);

// ---------- Auth (รองรับทั้ง JSON และ PEM เดี่ยว) ----------
function getAuth() {
  // 1) ถ้ามีทั้ง JSON ก้อนเดียว ใช้ทางนี้ (เสถียรสุด)
  const rawJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (rawJson) {
    const creds = JSON.parse(rawJson);
    if (!creds.client_email || !creds.private_key) {
      throw new Error('Invalid GOOGLE_CREDENTIALS_JSON');
    }
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    return new google.auth.JWT(creds.client_email, undefined, creds.private_key, scopes);
  }

  // 2) Fallback: ใช้ PEM เดี่ยวใน GOOGLE_SERVICE_ACCOUNT_KEY
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  let key = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();

  // แปลง escape -> newline จริง
  if (key.includes('\\r\\n')) key = key.replace(/\\r\\n/g, '\n');
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');

  // กันกรณีวางแล้วมี " หรือ ' ครอบทั้งก้อน
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // ตัดช่องว่างหัวท้ายอีกครั้ง
  key = key.trim();

  // ตรวจโครงสร้างหัว-ท้าย
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY format');
  }
  if (!email.endsWith('.iam.gserviceaccount.com')) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_EMAIL');
  }

  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.JWT(email, undefined, key, scopes);
}

// ---------- Time helpers ----------
function nowDateTimeBangkok() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now).replace(/\./g, ':'); // HH:MM:SS
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

// ---------- Sheets helpers ----------
async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets ?? []).some((s: any) => s.properties?.title === title);
  if (exists) return;

  // สร้างแท็บใหม่
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  // ใส่ header แถวแรก
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1:H1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[ 'Date','Time','BillNo','Items','Freebies','TotalQty','Payment','Total' ]],
    },
  });
}

// อ่านบิลของ "วันนั้น" ในแท็บ location แล้วให้เลขถัดไป (01,02,...)
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
  const dataRows = rows.slice(1); // ข้าม header

  let maxNo = 0;
  for (const r of dataRows) {
    const rowDate = r[0];               // A: Date
    const bill = (r[2] || '').trim();   // C: BillNo
    if (rowDate === date && bill) {
      const num = parseInt(bill, 10);   // "01" ก็ parse ได้เป็น 1
      if (!isNaN(num) && num > maxNo) maxNo = num;
    }
  }
  return pad2(maxNo + 1);
}

// ---------- Route ----------
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

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'GOOGLE_SHEETS_ID is missing' }, { status: 500 });
    }

    const auth = getAuth(); // ← จุดที่ต้องได้ key/JSON ถูกต้อง
    const sheets = google.sheets({ version: 'v4', auth });

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
      useBillNo = await getNextBillNoForDate(sheets, spreadsheetId, tabTitle, useDate!);
    }

    // เตรียมข้อมูลลงชีต
    const itemsText = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const freebiesText = (freebies ?? []).map(f => `${f.name} x${f.qty}`).join('; ');
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0); // ไม่นับของแถม

    // Append แถวใหม่
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabTitle}!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          useDate,                    // A: Date
          useTime,                    // B: Time
          useBillNo,                  // C: BillNo (รีเซ็ตทุกวันในแต่ละสาขา)
          itemsText,                  // D: Items
          freebiesText,               // E: Freebies
          String(totalQty),           // F: TotalQty (ไม่รวมของแถม)
          payment,                    // G: Payment
          Number(total).toFixed(2),   // H: Total (หลังหักของแถมแล้ว)
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
    // Log ละเอียดเพื่อไล่ปัญหา ENV/Key
    console.error('POST /api/orders -> Sheets error', e?.message || e, e?.errors, e?.stack);
    return NextResponse.json({ error: `Sheets write failed: ${e?.message || 'unknown'}` }, { status: 500 });
  }
}
