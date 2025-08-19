// app/lib/sheets.ts
import { google } from 'googleapis';

const TZ = 'Asia/Bangkok';
export const ALLOWED_TABS = new Set(['FLAGSHIP', 'SINDHORN', 'CHIN3', 'ORDERS']);

export function getAuth() {
  const rawJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (rawJson) {
    const creds = JSON.parse(rawJson);
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    return new google.auth.JWT(creds.client_email, undefined, creds.private_key, scopes);
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  let key = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();
  if (key.includes('\\r\\n')) key = key.replace(/\\r\\n/g, '\n');
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.trim();

  if (!key.startsWith('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY format');
  }
  if (!email.endsWith('.iam.gserviceaccount.com')) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_EMAIL');
  }

  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.JWT(email, undefined, key, scopes);
}

export function toBangkokDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

export async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets ?? []).some((s: any) => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${title}!A1:I1`, valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[ 'Date','Time','BillNo','Items','Freebies','TotalQty','Payment','Total','FreebiesAmount' ]] },
    });
  }
}

export type HistoryRow = {
  date: string; time: string; billNo: string; items: string;
  freebies: string; totalQty: number; payment: string; total: number;
  freebiesAmount: number;
};

export async function fetchHistory(spreadsheetId: string, tabTitle: string, date: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureSheetExists(sheets, spreadsheetId, tabTitle);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `${tabTitle}!A:I`,
  });

  const rows: string[][] = res.data.values || [];
  const data = rows.slice(1)
    .map(r => ({
      date: r[0] || '',
      time: r[1] || '',
      billNo: r[2] || '',
      items: r[3] || '',
      freebies: r[4] || '',
      totalQty: Number(r[5] || 0),
      payment: r[6] || '',
      total: Number((r[7] || '0').toString().replace(/,/g, '')),
      freebiesAmount: Number((r[8] || '0').toString().replace(/,/g, '')),
    } as HistoryRow))
    .filter(row => row.date === date);

  const totals = {
    count: data.length,
    totalQty: data.reduce((s, r) => s + (r.totalQty || 0), 0),
    totalAmount: data.reduce((s, r) => s + (r.total || 0), 0),
    freebiesAmount: data.reduce((s, r) => s + (r.freebiesAmount || 0), 0),
    byPayment: data.reduce<Record<string, number>>((acc, r) => {
      acc[r.payment] = (acc[r.payment] || 0) + (r.total || 0);
      return acc;
    }, {}),
  };

  return { rows: data, totals };
}
