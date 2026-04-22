// app/lib/sheets.ts
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
  status?: string;
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

/** ---------- Sheet Management ---------- */
export async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets ?? []).some((s: any) => s.properties?.title === title);
  
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }

  // Ensure header with Status column at J
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${a1Sheet(title)}!A1:J1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['Date', 'Time', 'BillNo', 'Items', 'Freebies', 'TotalQty', 'Payment', 'Total', 'FreebiesAmount', 'Status']],
    },
  });
}

export async function ensureSheetExistsIdempotent(sheets: any, spreadsheetId: string, title: string, header?: string[]) {
  try {
    await ensureSheetExists(sheets, spreadsheetId, title);
    if (header) {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${a1Sheet(title)}!1:1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [header] },
        });
    }
  } catch (e) {
    // Ignore already exists errors
  }
}

/** ---------- Data Fetching ---------- */
export async function listLocationIds(sheets: any, spreadsheetId: string): Promise<string[]> {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets || []).map((s: any) => s.properties.title).filter((t: string) => !['Products', 'Locations', 'Stocks'].includes(t));
}

export async function fetchHistory(spreadsheetId: string, tabTitle: string, date: string): Promise<{ rows: HistoryRow[]; totals: Totals }> {
  const rows = await fetchHistoryRange(spreadsheetId, tabTitle, date, date);
  return { rows, totals: summarizeTotals(rows) };
}

export async function fetchHistoryRange(spreadsheetId: string, tabTitle: string, startDate: string, endDate: string): Promise<HistoryRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureSheetExists(sheets, spreadsheetId, tabTitle);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${a1Sheet(tabTitle)}!A:M`,
  });

  const rows = res.data.values || [];
  return rows.slice(1).map((r: any[]) => ({
    date: (r?.[0] ?? '').toString().trim(),
    time: (r?.[1] ?? '').toString().trim(),
    billNo: (r?.[2] ?? '').toString().trim(),
    items: (r?.[3] ?? '').toString().trim(),
    freebies: (r?.[4] ?? '').toString().trim(),
    totalQty: parseNumberCell(r?.[5]),
    payment: (r?.[6] ?? '').toString().trim(),
    total: parseNumberCell(r?.[7]),
    freebiesAmount: parseNumberCell(r?.[8]),
    status: (r?.[12] ?? '').toString().trim(),
  })).filter(r => r.date >= startDate && r.date <= endDate);
}

/** ---------- Totals & Period Logic ---------- */
export function summarizeTotals(rows: HistoryRow[]): Totals {
  const activeRows = rows.filter(r => r.status !== 'VOIDED');
  const freebiesQty = activeRows.reduce((s, r) => s + countQtyFromFreebiesCell(r.freebies), 0);
  const totalQtyAll = activeRows.reduce((s, r) => s + (r.totalQty || 0), 0);

  return {
    count: activeRows.length,
    totalQty: Math.max(0, totalQtyAll - freebiesQty),
    freebiesQty,
    totalAmount: activeRows.reduce((s, r) => s + (r.total || 0), 0),
    freebiesAmount: activeRows.reduce((s, r) => s + (r.freebiesAmount || 0), 0),
    byPayment: activeRows.reduce((acc: any, r) => {
      acc[r.payment || '-'] = (acc[r.payment || '-'] || 0) + (r.total || 0);
      return acc;
    }, {})
  };
}

export function aggregateByPeriod(rows: HistoryRow[], period: Period) {
  const buckets = new Map<string, HistoryRow[]>();
  rows.forEach(r => {
    let key = r.date;
    if (period === 'weekly') {
        const d = new Date(r.date);
        d.setDate(d.getDate() - (d.getDay() + 6) % 7);
        key = toBangkokDateString(d);
    } else if (period === 'monthly') {
        key = r.date.slice(0, 7);
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  });
  return Array.from(buckets.entries()).map(([key, rs]) => ({ key, totals: summarizeTotals(rs) }));
}
