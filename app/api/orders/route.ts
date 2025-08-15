// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// ต้องใช้ Node runtime (ไม่ใช่ Edge) เพื่อให้ googleapis ใช้ได้
export const runtime = 'nodejs';
// ป้องกันการ cache/prerender
export const dynamic = 'force-dynamic';

type Item = { name: string; qty: number; price: number };
type Body = {
  location: string;                 // เช่น 'FRONT' | 'SINDHORN' | 'CHIN3'
  billNo?: string;                  // ถ้ามีเลขบิลจากฝั่งเซิร์ฟเวอร์แล้ว ใส่มาด้วย (ไม่บังคับ)
  payment: 'cash' | 'promptpay';    // วิธีจ่าย
  items: Item[];                    // รายการสินค้า
  total: number;                    // ยอดรวม
};

// ฟอร์แมตวันที่-เวลาให้เป็นโซนไทยเสมอ
function formatInBangkok(now: Date) {
  const tz = 'Asia/Bangkok';
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(now); // HH:MM:SS
  return { date, time };
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  // ถ้า key ใน ENV มี \n แบบ escape ให้แปลงเป็นบรรทัดจริง
  const key = keyRaw.includes('\\n') ? keyRaw.replace(/\\n/g, '\n') : keyRaw;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.JWT(email, undefined, key, scopes);
}

export async function POST(req: Request) {
  try {
    const { location, billNo, items, payment, total } = (await req.json()) as Body;

    if (!location || !items?.length || !payment || typeof total !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const now = new Date();
    const { date, time } = formatInBangkok(now);
    const itemsText = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const range = 'Orders!A:H'; // ต้องมีแท็บชื่อ Orders และคอลัมน์ A..H

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          date,           // A: Date (YYYY-MM-DD)
          time,           // B: Time (HH:MM:SS) Asia/Bangkok
          location,       // C: Location
          billNo ?? '',   // D: BillNo (ว่างได้ถ้ายังไม่มี)
