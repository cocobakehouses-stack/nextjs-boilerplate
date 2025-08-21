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

  const totals = summarizeTotals(history);
  return { header, history, totals };
}

// โหลด history ตามช่วงวัน
export async function fetchHistoryRange(
  sheets: any,
  spreadsheetId: string,
  title: string,
  startDate: string,
  endDate: string
) {
  const { header, history } = await fetchHistory(sheets, spreadsheetId, title);

  const filtered = history.filter(h => {
    if (!h.date) return false;
    return h.date >= startDate && h.date <= endDate;
  });

  const totals = summarizeTotals(filtered);
  return { header, history: filtered, totals };
}

// รวมผลรวม
export function summarizeTotals(history: any[]) {
  return {
    count: history.length,
    totalQty: history.reduce((s, h) => s + (h.totalQty || 0), 0),
    totalAmount: history.reduce((s, h) => s + (h.total || 0), 0),
    freebiesAmount: history.reduce((s, h) => s + (h.freebiesAmount || 0), 0),
    byPayment: history.reduce((acc, h) => {
      const k = h.payment || 'UNKNOWN';
      acc[k] = (acc[k] || 0) + (h.total || 0);
      return acc;
    }, {} as Record<string, number>),
  };
}

export type Period = 'daily' | 'weekly' | 'monthly';

// สรุปแยกตาม period
export function aggregateByPeriod(history: any[], period: Period) {
  const buckets: Record<string, any> = {};

  history.forEach(h => {
    let key = h.date;
    if (period === 'weekly') {
      const d = new Date(`${h.date}T00:00:00+07:00`);
      const day = (d.getDay() + 6) % 7; // Mon=0
      const startD = new Date(d);
      startD.setDate(d.getDate() - day);
      const wkKey = toBangkokDateString(startD);
      key = wkKey;
    } else if (period === 'monthly') {
      key = h.date?.slice(0, 7); // YYYY-MM
    }
    if (!key) return;

    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(h);
  });

  // map เป็น summary
  return Object.entries(buckets).map(([k, rows]) => ({
    key: k,
    totals: summarizeTotals(rows as any[]),
  }));
}
