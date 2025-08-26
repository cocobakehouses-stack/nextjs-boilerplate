// app/api/products/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'Products';
type Product = { id: number; name: string; price: number; active?: boolean };

async function ensureProductsSheetExists(sheets: any, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const exists = (meta.data.sheets ?? []).some(
    (s: any) => s.properties?.title === PRODUCTS_TAB
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: PRODUCTS_TAB } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['ID', 'Name', 'Price', 'Active']] },
    });
  }
}

function parseNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/** ---------- GET: list products ---------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeAll = url.searchParams.get('all') === '1';

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
    });

    let products: Product[] = ((res.data.values || []).slice(1) as string[][])
      .map((r) => {
        const id = parseNum(r?.[0]);
        const name = (r?.[1] || '').toString().trim();
        const price = parseNum(r?.[2]);
        const activeStr = (r?.[3] || '').toString().trim().toLowerCase();
        const active = activeStr === '' ? true : ['true', '1', 'yes', 'y'].includes(activeStr);
        if (!Number.isFinite(id) || !name || !Number.isFinite(price)) return null;
        return { id, name, price, active };
      })
      .filter(Boolean) as Product[];

    // POS: เฉพาะ active (default). หน้าแอดมิน: ?all=1
    if (!includeAll) products = products.filter((p) => p.active !== false);

    products.sort((a, b) => b.price - a.price);

    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/products error', e?.message || e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

/** ---------- POST: add product ---------- */
export async function POST(req: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Missing GOOGLE_SHEETS_ID' }, { status: 500 });
    }

    const { name, price } = await req.json();
    const normName = (name || '').toString().trim();
    const normPrice = parseNum(price);

    if (!normName || !Number.isFinite(normPrice) || normPrice <= 0) {
      return NextResponse.json({ error: 'Invalid name/price' }, { status: 400 });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    // หา next id = max(id) + 1
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:A`,
    });
    const ids = ((res.data.values || []).slice(1) as any[])
      .map((r) => parseNum(r?.[0]))
      .filter((n) => Number.isFinite(n)) as number[];
    const nextId = (ids.length ? Math.max(...ids) : 0) + 1;

    // append (Active = TRUE)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[nextId, normName, normPrice, true]] },
    });

    return NextResponse.json({ ok: true, product: { id: nextId, name: normName, price: normPrice } });
  } catch (e: any) {
    console.error('POST /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

/** ---------- PATCH: toggle active ---------- */
export async function PATCH(req: Request) {
  try {
    const { id, active } = await req.json();
    const numId = Number(id);
    if (!Number.isFinite(numId) || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid id/active' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    // อ่านทั้งตารางเพื่อหาแถวของ id
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
    });
    const all = res.data.values || [];
    const rows = all.slice(1); // ข้าม header

    let rowIndex = -1; // index ใน rows (เริ่ม 0)
    for (let i = 0; i < rows.length; i++) {
      const rid = parseNum(rows[i]?.[0]);
      if (rid === numId) { rowIndex = i; break; }
    }
    if (rowIndex < 0) {
      return NextResponse.json({ error: 'ID not found' }, { status: 404 });
    }

    // คอลัมน์ D = Active → แถวจริง = rowIndex + 2 (เพราะ row 1 คือ header)
    const targetRange = `${PRODUCTS_TAB}!D${rowIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: targetRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true, id: numId, active });
  } catch (e: any) {
    console.error('PATCH /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

/** ---------- OPTIONS: preflight ---------- */
export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
