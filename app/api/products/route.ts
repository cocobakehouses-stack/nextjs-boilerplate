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
  // ตัด , และตัวอักษรที่ไม่ใช่ตัวเลขออก
  const n = Number(String(x ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '').trim());
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

    const rows: string[][] = (res.data.values || []).slice(1); // ตัด header

    const used = new Set<number>();
    let nextAuto = 1000;
    const allocId = (suggest?: number) => {
      let id = suggest;
      if (!Number.isFinite(id) || used.has(id as number)) {
        do { id = nextAuto++; } while (used.has(id as number));
      }
      used.add(id as number);
      return id as number;
    };

    const products: Product[] = rows
      .map((r) => {
        const rawId = parseNum(r[0]);
        const name = (r[1] || '').toString().trim();
        const price = parseNum(r[2]);
        const activeStr = (r[3] || '').toString().trim().toLowerCase();
        const active = activeStr === '' ? true : ['true', '1', 'yes', 'y'].includes(activeStr);

        if (!name || !Number.isFinite(price)) return null; // ต้องมีชื่อและราคาที่เป็นตัวเลข

        // ถ้า id ไม่โอเค/ซ้ำ จะให้ไอดีใหม่อัตโนมัติ
        const safeId = allocId(Number.isFinite(rawId) ? Number(rawId) : undefined);

        return { id: safeId, name, price: Number(price), active };
      })
      .filter(Boolean)
      .filter((p) => (p as Product).active !== false) as Product[];

    // เรียงราคาสูง → ต่ำ (เหมือนเดิม)
    products.sort((a, b) => b.price - a.price);

    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}