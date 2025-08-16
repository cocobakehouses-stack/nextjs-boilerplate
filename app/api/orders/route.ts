// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// ใช้ Node runtime สำหรับ googleapis
export const runtime = 'nodejs';
// กันไม่ให้โดน prerender/cache
export const dynamic = 'force-dynamic';

type Item = { name: string; qty: number; price: number };
type Body = {
  location: string;                 // เช่น 'FRONT' | 'SINDHORN' | 'CHIN3'
  billNo?: string;                  // เลขบิล (ไม่บังคับ)
  payment: 'cash' | 'promptpay';    // วิธีจ่าย
  items: Item[];                    // รายการสินค้า
  total: number;                    // ยอดรวม
};

// ฟอร์แมตเวลาเป็นโซนไทย
function formatInBangkok(now: Date) {
  const tz = 'Asia/Bangkok';
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
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
    const range = 'Orders!A:H'; // ต้องมีแท็บชื่อ "Orders"

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          date,                 // A: Date
          time,                 // B: Time
          location,             // C: Location
          billNo ?? '',         // D: BillNo
          itemsText,            // E: Items
          String(totalQty),     // F: TotalQty
          payment,              // G: Payment
          Number(total).toFixed(2), // H: Total
        ]],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/orders -> Sheets error', e?.message || e);
    return NextResponse.json({ error: 'Sheets write failed' }, { status: 500 });
  }
}
