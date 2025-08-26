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
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    const url = new URL(req.url);
    const all = url.searchParams.get('all') === '1';

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
    });

    const rows: string[][] = (res.data.values || []).slice(1);
    const parsed: (Product | null)[] = rows.map((r) => {
      const id = parseNum(r?.[0]);
      const name = (r?.[1] || '').toString().trim();
      const price = parseNum(r?.[2]);
      const activeStr = (r?.[3] || '').toString().trim().toLowerCase();
      const active = activeStr === '' ? true : ['true', '1', 'yes', 'y'].includes(activeStr);
      if (!Number.isFinite(id) || !name || !Number.isFinite(price)) return null;
      return { id, name, price, active };
    });

    let products = parsed.filter(Boolean) as Product[];
    if (!all) products = products.filter((p) => p.active !== false);

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

    // read to compute next ID
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:A`,
    });
    const rows: string[][] = (res.data.values || []).slice(1);
    const ids = rows.map((r) => parseNum(r?.[0])).filter((n) => Number.isFinite(n)) as number[];
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    // append (Active default TRUE)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[nextId, normName, normPrice, true]] },
    });

    return NextResponse.json({ ok: true, product: { id: nextId, name: normName, price: normPrice, active: true } });
  } catch (e: any) {
    console.error('POST /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

/** ---------- PATCH: toggle active ---------- */
export async function PATCH(req: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Missing GOOGLE_SHEETS_ID' }, { status: 500 });
    }

    const { id, active } = await req.json();
    const numId = parseNum(id);
    const boolActive = !!active;

    if (!Number.isFinite(numId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    // read to find row index
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:A`,
    });
    const rows: string[][] = (res.data.values || []);
    // include header in index math; find in slice(1) but add 2 to get 1-based row number
    const bodyRows = rows.slice(1);
    const idx = bodyRows.findIndex((r) => parseNum(r?.[0]) === numId);
    if (idx === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const rowNumber = idx + 2; // header is row 1

    // update column D for that row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!D${rowNumber}:D${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[boolActive ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true, id: numId, active: boolActive });
  } catch (e: any) {
    console.error('PATCH /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
