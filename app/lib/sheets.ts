// app/lib/sheets.ts
import { google } from 'googleapis';

/** ---------- Constants & Types ---------- */
export const TZ = 'Asia/Bangkok';

// ใช้เป็น safe set ขั้นต้น ถ้ามีระบบ Locations ภายหลังแนะนำให้ดึงจากแท็บ Locations แทน
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
};

export type Totals = {
  count: number;
  totalQty: number;
  totalAmount: number;
  freebiesAmount: number;
  byPayment: Record<string, number>;
};

export type Period = 'daily' | 'weekly' | 'monthly';

/** ---------- Auth ---------- */
export function getAuth() {
  // รองรับได้หลายรูปแบบ ENV เพื่อความสะดวกในการ deploy
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

  // แบบ service account มาตรฐาน
  const email =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL ||
    '';

  let key =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SHEETS_PRIVATE_KEY ||
    '';

  if (key.includes('\\r\\n')) key = key.replace(/\\r\\n/g, '\n');
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.trim();

  if (!email || !key) {
    throw new Error(
      'Service Account credentials are missing. Please set GOOGLE_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY (or GOOGLE_SHEETS_CLIENT_EMAIL/PRIVATE_KEY).'
    );
  }

  return new google.auth.JWT(email, undefined, key, [
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
}

/** ---------- Utils ---------- */
export function toBangkokDateString(date: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date); // YYYY-MM-DD
}

// ครอบชื่อชีตใน A1 notation ให้ปลอดภัย (มีเว้นวรรค/อักขระพิเศษ/มี quote)
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
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });

  // ตั้งหัวคอลัมน์ A..I ให้ตรงกับระบบ
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${a1Sheet(title)}!A1:I1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        [
          'Date',
          'Time',
          'BillNo',
          'Items',
          'Freebies',
          'TotalQty',
          'Payment',
          'Total',
          'FreebiesAmount',
        ],
      ],
    },
  });
}

/** ---------- Parsers ---------- */
function parseNumberCell(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** ---------- History (single date) ---------- */
export async function fetchHistory(
  spreadsheetId: string,
  tabTitle: string,
  date: string
): Promise<{ rows: HistoryRow[]; totals: Totals }> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureSheetExists(sheets, spreadsheetId, tabTitle);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${a1Sheet(tabTitle)}!A:I`,
  });

  const rows = res.data.values || [];
  const data = rows.slice(1); // skip header

  const all: HistoryRow[] = data.map((r) => ({
    date: (r[0] || '').toString().trim(),
    time: (r[1] || '').toString().trim(),
    billNo: (r[2] || '').toString().trim(),
    items: (r[3] || '').toString().trim(),
    freebies: (r[4] || '').toString().trim(),
    totalQty: parseNumberCell(r[5]),
    payment: (r[6] || '').toString().trim(),
    total: parseNumberCell(r[7]),
    freebiesAmount: parseNumberCell(r[8]),
  }));

  const rowsForDate = all.filter((r) => r.date === date);
  const totals = summarizeTotals(rowsForDate);

  return { rows: rowsForDate, totals };
}

/** ---------- History (date range) ---------- */
export async function fetchHistoryRange(
  spreadsheetId: string,
  tabTitle: string,
  startDate: string, // inclusive
  endDate: string // inclusive
): Promise<HistoryRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureSheetExists(sheets, spreadsheetId, tabTitle);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${a1Sheet(tabTitle)}!A:I`,
  });

  const rows = res.data.values || [];
  const data = rows.slice(1);

  const all: HistoryRow[] = data.map((r) => ({
    date: (r[0] || '').toString().trim(),
    time: (r[1] || '').toString().trim(),
    billNo: (r[2] || '').toString().trim(),
    items: (r[3] || '').toString().trim(),
    freebies: (r[4] || '').toString().trim(),
    totalQty: parseNumberCell(r[5]),
    payment: (r[6] || '').toString().trim(),
    total: parseNumberCell(r[7]),
    freebiesAmount: parseNumberCell(r[8]),
  }));

  // filter by date range inclusive
  const start = startDate;
  const end = endDate;
  return all.filter((r) => r.date >= start && r.date <= end);
}

/** ---------- Totals helpers ---------- */
export function summarizeTotals(rows: HistoryRow[]): Totals {
  const count = rows.length;
  const totalQty = rows.reduce((s, r) => s + (r.totalQty || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (r.total || 0), 0);
  const freebiesAmount = rows.reduce((s, r) => s + (r.freebiesAmount || 0), 0);
  const byPayment = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.payment || '-';
    acc[k] = (acc[k] || 0) + (r.total || 0);
    return acc;
  }, {});
  return { count, totalQty, totalAmount, freebiesAmount, byPayment };
}

/** ---------- Aggregation by period ---------- */
function weekKeyYYYYMMDD_Mon(dateStr: string): string {
  // คืนวันจันทร์ของสัปดาห์ในกรุงเทพฯเป็น key (YYYY-MM-DD)
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  const jsDay = d.getDay(); // Sun=0..Sat=6
  // ทำให้ Mon=0..Sun=6
  const monBased = (jsDay + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - monBased);
  return toBangkokDateString(monday);
}

function monthKeyYYYYMM(dateStr: string): string {
  // ตัดเป็น YYYY-MM (เดือนของวันที่นั้น)
  return dateStr.slice(0, 7);
}

export function aggregateByPeriod(
  rows: HistoryRow[],
  period: Period
): Array<{ key: string; totals: Totals }> {
  const buckets = new Map<string, HistoryRow[]>();

  for (const r of rows) {
    let key = r.date;
    if (period === 'weekly') key = weekKeyYYYYMMDD_Mon(r.date);
    if (period === 'monthly') key = monthKeyYYYYMM(r.date);

    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }

  const out: Array<{ key: string; totals: Totals }> = [];
  for (const [key, rs] of buckets) {
    out.push({ key, totals: summarizeTotals(rs) });
  }

  // sort key asc
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}
