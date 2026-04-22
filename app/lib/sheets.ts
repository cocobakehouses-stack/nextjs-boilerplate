import { google } from 'googleapis';

/** ---------- Constants & Types ---------- */
export const TZ = 'Asia/Bangkok';

export const ALLOWED_TABS = new Set(['FLAGSHIP', 'SINDHORN', 'CHIN3', 'ORDERS']);

export type HistoryRow = {
  date: string;
  time: string;
  billNo: string;
  items: string;
  freebies: string;
  totalQty: number;
  payment: string;
  total: number;
  freebiesAmount: number;
  status?: string; // Added Status column
};

export type Totals = {
  count: number;
  totalQty: number;      
  freebiesQty: number;   
  totalAmount: number;
  freebiesAmount: number;
  byPayment: Record<string, number>;
};

export type Period = 'daily' | 'weekly' | 'monthly';

/** ---------- Auth ---------- */
export function getAuth() {
  const rawJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (rawJson) {
    const creds = JSON.parse(rawJson);
    return new google.auth.JWT(
      creds.client_email,
      undefined,
      creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '';
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SHEETS_PRIVATE_KEY || '';

  if (key.includes('\\r\\n')) key = key.replace(/\\r\\n/g, '\n');
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.trim();

  if (!email || !key) {
    throw new Error('Service Account credentials missing.');
  }

  return new google.auth.JWT(email, undefined, key, [
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
}

/** ---------- Utils ---------- */
export function toBangkokDateString(date: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

export function a1Sheet(title: string) {
  const escaped = String(title).replace(/'/g, "''");
  return `'${escaped}'`;
}

/** ---------- Sheet helpers ---------- */
export async function ensureSheetExists(
  sheets: any,
  spreadsheetId: string,
  title: string
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const exists = (meta.data.sheets ?? []).some(
    (s: any) => s.properties?.title === title
  );
  if (exists) {
    // If it exists, ensure the "Status" header is there at J1
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${a1Sheet(title)}!J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Status']] },
      });
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });

  // Updated headers to include "Status" at Column J
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${a1Sheet(title)}!A1:J1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['Date', 'Time', 'BillNo', 'Items', 'Freebies', 'TotalQty', 'Payment', 'Total', 'FreebiesAmount', 'Status'],
      ],
    },
  });
}

/** ---------- Parsers ---------- */
function parseNumberCell(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function countQtyFromFreebiesCell(cell: any): number {
  const txt = String(cell ?? '').trim();
  if (!txt) return 0;
  let qty = 0;
  const m = txt.matchAll(/(?:x|×)\s*(\d+)/gi);
  for (const g of m) qty += Number(g[1] || 0);
  if (qty > 0) return qty;
  const parts = txt.split(/[,+;|/]/g).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts.length : 0;
}

/** ---------- History (date range) ---------- */
export async function fetchHistoryRange(
  spreadsheetId: string,
  tabTitle: string,
  startDate: string,
  endDate: string
): Promise<HistoryRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureSheetExists(sheets, spreadsheetId, tabTitle);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${a1Sheet(tabTitle)}!A:J`, // Extended to J
  });

  const rows = res.data.values || [];
  const data = rows.slice(1);

  const all: HistoryRow[] = data.map((r: any[]) => ({
    date: (r?.[0] ?? '').toString().trim(),
    time: (r?.[1] ?? '').toString().trim(),
    billNo: (r?.[2] ?? '').toString().trim(),
    items: (r?.[3] ?? '').toString().trim(),
    freebies: (r?.[4] ?? '').toString().trim(),
    totalQty: parseNumberCell(r?.[5]),
    payment: (r?.[6] ?? '').toString().trim(),
    total: parseNumberCell(r?.[7]),
    freebiesAmount: parseNumberCell(r?.[8]),
    status: (r?.[9] ?? '').toString().trim(), // Read Status from Column J
  }));

  return all.filter((r) => r.date >= startDate && r.date <= endDate);
}

/** ---------- Totals helpers ---------- */
export function summarizeTotals(rows: HistoryRow[]): Totals {
  // IMPORTANT: Filter out voided rows so they don't count towards totals
  const activeRows = rows.filter(r => r.status !== 'VOIDED');
  
  const count = activeRows.length;
  const freebiesQty = activeRows.reduce((s, r) => s + countQtyFromFreebiesCell(r.freebies), 0);
  const totalQtyAll = activeRows.reduce((s, r) => s + (r.totalQty || 0), 0);
  const totalQty = Math.max(0, totalQtyAll - freebiesQty);
  const totalAmount = activeRows.reduce((s, r) => s + (r.total || 0), 0);
  const freebiesAmount = activeRows.reduce((s, r) => s + (r.freebiesAmount || 0), 0);

  const byPayment = activeRows.reduce<Record<string, number>>((acc, r) => {
    const k = r.payment || '-';
    acc[k] = (acc[k] || 0) + (r.total || 0);
    return acc;
  }, {});

  return { count, totalQty, freebiesQty, totalAmount, freebiesAmount, byPayment };
}

// ... rest of your listLocationIds and aggregateByPeriod functions ...
// Ensure summarizeTotals is called within aggregateByPeriod so the reports page is also filtered!
