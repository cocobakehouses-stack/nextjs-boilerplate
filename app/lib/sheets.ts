// app/lib/sheets.ts
import { google } from 'googleapis';

const TZ = 'Asia/Bangkok';

// 🔑 Auth
export function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// 🗂️ ให้สร้างแท็บอัตโนมัติถ้ายังไม่มี
export async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(s => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title,
              gridProperties: { rowCount: 1000, columnCount: 20 },
            },
          },
        }],
      },
    });

    // เติมหัวคอลัมน์ A..I
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1:I1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'Date', 'Time', 'BillNo', 'Items', 'Freebies',
          'TotalQty', 'Payment', 'Total', 'FreebiesAmount',
        ]],
      },
    });
  }
}

// ======================
// 📌 Utilities
// ======================

export const ALLOWED_TABS = ['ORDERS', 'HISTORY', 'REPORTS']; // ปรับให้ตรงกับที่หมวยใช้จริง

export function toBangkokDateString(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

// ======================
// 📊 History + Reports
// ======================

export async function fetchHistory(sheets: any, spreadsheetId: string, tab: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A2:I`,
  });
  const rows = res.data.values || [];
  const data = rows.map(r => ({
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

  // รวม totals
  const totals = {
    totalQty: data.reduce((s, r) => s + r.totalQty, 0),
    totalAmount: data.reduce((s, r) => s + r.total, 0),
    freebiesAmount: data.reduce((s, r) => s + r.freebiesAmount, 0),
  };

  return { data, totals };
}

export async function fetchHistoryRange(
  sheets: any,
  spreadsheetId: string,
  tab: string,
  start: string,
  end: string
) {
  const { data } = await fetchHistory(sheets, spreadsheetId, tab);
  const filtered = data.filter(r => r.date >= start && r.date <= end);
  return filtered;
}

export function summarizeTotals(rows: any[]) {
  return {
    totalQty: rows.reduce((s, r) => s + (r.totalQty || 0), 0),
    totalAmount: rows.reduce((s, r) => s + (r.total || 0), 0),
    freebiesAmount: rows.reduce((s, r) => s + (r.freebiesAmount || 0), 0),
  };
}

export function aggregateByPeriod(rows: any[], period: 'day' | 'week' | 'month') {
  const groups: Record<string, any[]> = {};
  for (const r of rows) {
    let key = r.date;
    if (period === 'week') {
      // เอาเฉพาะ yyyy-Wxx
      const d = new Date(r.date);
      const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
      const pastDays = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
      const week = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
      key = `${d.getFullYear()}-W${week}`;
    } else if (period === 'month') {
      key = r.date.substring(0, 7); // yyyy-MM
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return Object.entries(groups).map(([key, items]) => ({
    key,
    ...summarizeTotals(items),
  }));
}
