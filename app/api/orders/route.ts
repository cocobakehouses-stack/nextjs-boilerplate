// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Item = { name: string; qty: number; price: number };
type Body = {
  location: string;               // 'FLAGSHIP' | 'SINDHORN' | 'CHIN3'
  billNo?: string;
  payment: 'cash' | 'promptpay';
  items: Item[];
  total: number;
};

// อนุญาตเฉพาะแท็บเหล่านี้ (กันสะกดเพี้ยน)
const ALLOWED_TABS = new Set(['FLAGSHIP', 'SINDHORN', 'CHIN3', 'ORDERS']);

function formatInBangkok(now: Date) {
  const tz = 'Asia/Bangkok';
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now); // HH:MM:SS
  return { date, time };
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const key = keyRaw.includes('\\n') ? keyRaw.replace(/\\n/g, '\n') : keyRaw;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.JWT(email, undefined, key, scopes);
}

// สร้างแท็บถ้ายังไม่มี + ใส่หัวคอลัมน์ตามลำดับใหม่
async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets ?? []).some((s: any) => s.properties?.title === title);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1:G1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[ 'Date','Time','BillNo','Items','TotalQty','Payment','Total' ]],
    },
  });
}

export async function POST(req: Request) {
  try {
    const { location, billNo, items, payment, total } = (await req.json()) as Body;
    if (!location || !items?.length || !payment || typeof total !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const tabTitle = (location || 'ORDERS').toUpperCase();
    if (!ALLOWED_TABS.has(tabTitle)) {
      return NextResponse.json({ error: 'Invalid location/tab' }, { status: 400 });
    }

    const { date, time } = formatInBangkok(new Date());
    const itemsText = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);

    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    // ✅ ใช้ชื่อแท็บตามสาขา และสร้างหัวตารางอัตโนมัติถ้ายังไม่มี
    await ensureSheetExists(sheets, spreadsheetId, tabTitle);

    // ✅ เขียนลงแท็บของสาขา และเรียงคอลัมน์ตามที่หมวยต้องการ
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabTitle}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          date,                // A: Date
          time,                // B: Time
          billNo ?? '',        // C: BillNo
          itemsText,           // D: Items
          String(totalQty),    // E: TotalQty
          payment,             // F: Payment
          Number(total).toFixed(2), // G: Total
        ]],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/orders -> Sheets error', e?.message || e);
    return NextResponse.json({ error: 'Sheets write failed' }, { status: 500 });
  }
}
