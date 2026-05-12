import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'Products';

function parseNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

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
    // Headers: A:ID, B:Name, C:Price, D:Category, E:Active
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A1:E1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['ID', 'Name', 'Price', 'Category', 'Active']] },
    });
  }
}

/** ---------- GET: list products ---------- */
export async function GET(req: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    const { searchParams } = new URL(req.url);
    const p = (searchParams.get('activeOnly') ?? '').toLowerCase();
    const activeOnly = p ? !['0', 'false', 'no', 'off'].includes(p) : true;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:E`,
    });

    const rows: any[][] = (res.data.values || []).slice(1);
    const products = rows.map((r) => {
      const id = parseNum(r?.[0]);
      const name = (r?.[1] || '').toString().trim();
      const price = parseNum(r?.[2]);
      const category = (r?.[3] || 'General').toString().trim();
      const activeStr = (r?.[4] || '').toString().trim().toLowerCase();
      
      const active = activeStr === '' ? true : ['true', '1', 'yes', 'on'].includes(activeStr);

      if (!Number.isFinite(id) || !name) return null;
      return { id, name, price, category, active };
    }).filter(Boolean);

    let filtered = products as any[];
    if (activeOnly) filtered = filtered.filter((p) => p.active !== false);

    return NextResponse.json(
      { products: filtered.sort((a, b) => a.id - b.id) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('GET /api/products error', e?.message || e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

/** ---------- POST: add product ---------- */
export async function POST(req: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const { name, price, category } = await req.json();
    const normName = (name || '').toString().trim();
    const normPrice = parseNum(price);
    const normCat = (category || 'General').toString().trim();

    if (!normName || !Number.isFinite(normPrice)) {
      return NextResponse.json({ error: 'Invalid name/price' }, { status: 400 });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    await ensureProductsSheetExists(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:A`,
    });
    const rows = res.data.values || [];
    const ids = rows.slice(1).map(r => parseNum(r[0])).filter(Number.isFinite);
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[nextId, normName, normPrice, normCat, 'TRUE']] },
    });

    return NextResponse.json({ ok: true, product: { id: nextId, name: normName, price: normPrice, category: normCat, active: true } });
  } catch (e: any) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
