// app/api/products/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'Products'; // A: ID | B: Name | C: Price | D: Active (optional)

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

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
    });

    const rows: string[][] = (res.data.values || []).slice(1); // skip header
    const products: Product[] = rows
      .map((r) => {
        const id = parseNum(r[0]);
        const name = (r[1] || '').toString().trim();
        const price = parseNum(r[2]);
        const activeStr = (r[3] || '').toString().trim().toLowerCase();
        const active =
          activeStr === '' ? true : ['true', '1', 'yes', 'y'].includes(activeStr);
        if (!Number.isFinite(id) || !name || !Number.isFinite(price)) return null;
        return { id: Number(id), name, price: Number(price), active };
      })
      .filter(Boolean)
      .filter((p) => (p as Product).active !== false) as Product[];

    // UX เดิม: เรียงราคาสูง→ต่ำ
    products.sort((a, b) => b.price - a.price);

    return NextResponse.json(
      { products },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('GET /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureProductsSheetExists(sheets, spreadsheetId);

    const { name, price } = await req.json();
    const cleanName = (name || '').toString().trim();
    const cleanPrice = Number(price);

    if (!cleanName || !Number.isFinite(cleanPrice) || cleanPrice <= 0) {
      return NextResponse.json({ error: 'Invalid name/price' }, { status: 400 });
    }

    // หา next ID = max(existing IDs) + 1
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:A`,
    });
    const rows: string[][] = res.data.values || [];
    const ids = rows.slice(1).map(r => Number(r?.[0] ?? NaN)).filter(n => Number.isFinite(n)) as number[];
    const nextId = (ids.length ? Math.max(...ids) : 0) + 1;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[ nextId, cleanName, cleanPrice, 'TRUE' ]] },
    });

    return NextResponse.json({ ok: true, product: { id: nextId, name: cleanName, price: cleanPrice } });
  } catch (e:any) {
    console.error('POST /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
