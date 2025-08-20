// app/api/products/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ใช้แท็บชื่อ "Products" โครงสร้างคอลัมน์:
// A: ID (number) | B: Name (string) | C: Price (number) | (ออปชัน D: Active = TRUE/FALSE)
const PRODUCTS_TAB = 'Products';

type Product = { id: number; name: string; price: number; active?: boolean };

async function ensureProductsSheetExists(sheets: any, spreadsheetId: string) {
  // สร้างแท็บ + ตั้งหัวคอลัมน์ถ้าไม่มี
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

    // จัดเรียงราคาสูง→ต่ำ (ให้สอดคล้องกับ UX เดิม)
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
