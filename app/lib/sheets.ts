// app/lib/sheets.ts
import { google } from 'googleapis';

export const TZ = 'Asia/Bangkok';

// auth helper
export function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// แปลงวันที่เป็น string format YYYY-MM-DD (Bangkok)
export function toBangkokDateString(date: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

// ตรวจสอบและสร้างแท็บถ้ายังไม่มี
export async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.map((s: any) => s.properties?.title) || [];
  if (existing.includes(title)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title,
              gridProperties: { rowCount: 1000, columnCount: 20 },
            },
          },
        },
      ],
    },
  });

  // ตั้งหัวคอลัมน์ A..I
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1:I1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        'Date', 'Time', 'BillNo', 'Items', 'Freebies',
        'TotalQty', 'Payment', 'Total', 'FreebiesAmount'
      ]],
    },
  });
}

// โหลด history ทั้งหมดจากชีต
export async function fetchHistory(sheets: any, spreadsheetId: string, title: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A:I`,
  });
  const rows = res.data.values || [];
  const header = rows[0] || [];
  const dataRows = rows.slice(1);

  const history = dataRows.map(r => ({
    date: r[0],
    time: r[1],
    billNo: r[2],
    items: r[3],
    freebies: r[4],
    totalQty: Number(r[5] || 0),
    payment: r[6],
    total: Number(r[7] || 0),
    freebiesAmount: Number(r[8] || 0),
  }));

  const totals = {
    qty: history.reduce((s, h) => s + h.totalQty, 0),
    amount: history.reduce((s, h) => s + h.total, 0),
    freebiesAmount: history.reduce((s, h) => s + h.freebiesAmount, 0),
  };

  return { header, history, totals };
}
