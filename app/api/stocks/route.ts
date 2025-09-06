// app/api/stocks/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'PRODUCTS';
const STOCKS_TAB = 'STOCKS';

/** Idempotent: มีอยู่แล้วไม่ add ซ้ำ */
async function ensureTabExists(
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
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
}

/** เซ็ต header ให้ตรงสเปค (เรียกซ้ำได้ ปลอดภัย) */
async function ensureHeader(
  sheets: any,
  spreadsheetId: string,
  title: string,
  header: string[],
  a1: string
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${a1Sheet(title)}!${a1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [header] },
  });
}

function toInt(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.floor(n) : 0;
}
function toNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /api/stocks?location=FLAGSHIP
 * คืน { stocks: [{productId, name, price, qty}] }
 *
 * สคีมาในชีต:
 * - PRODUCTS: A:ID, B:Name, C:Price
 * - STOCKS  : A:Location, B:ProductID, C:Qty   (หนึ่งแถวต่อสินค้า-สาขา)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').trim().toUpperCase();

    if (!location) {
      return NextResponse.json({ error: 'location is required' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ ทำให้แน่ใจว่าแท็บมีจริง แต่ไม่ add ซ้ำ
    await ensureTabExists(sheets, spreadsheetId, PRODUCTS_TAB);
    await ensureTabExists(sheets, spreadsheetId, STOCKS_TAB);

    // ✅ เขียน header (เรียกซ้ำได้ ไม่พัง)
    await ensureHeader(
      sheets, spreadsheetId, PRODUCTS_TAB,
      ['ID', 'Name', 'Price'],
      'A1:C1'
    );
    await ensureHeader(
      sheets, spreadsheetId, STOCKS_TAB,
      ['Location', 'ProductID', 'Qty'],
      'A1:C1'
    );

    // อ่าน PRODUCTS
    const pRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(PRODUCTS_TAB)}!A:C`,
    });
    const pRows = (pRes.data.values || []).slice(1);
    const products = pRows
      .map((r: any[]) => ({
        id: toInt(r?.[0]),
        name: (r?.[1] ?? '').toString().trim(),
        price: toNum(r?.[2]),
      }))
      .filter((p) => p.id > 0 && p.name);

    // อ่าน STOCKS ของสาขานี้
    const sRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(STOCKS_TAB)}!A:C`,
    });
    const sRows = (sRes.data.values || []).slice(1);
    const qtyByPid = new Map<number, number>();
    for (const r of sRows) {
      const loc = (r?.[0] ?? '').toString().trim().toUpperCase();
      if (loc !== location) continue;
      const pid = toInt(r?.[1]);
      const qty = toInt(r?.[2]);
      if (pid > 0) qtyByPid.set(pid, qty);
    }

    // join เป็นรูปแบบที่หน้า UI ต้องการ
    const stocks = products.map((p) => ({
      productId: p.id,
      name: p.name,
      price: p.price,
      qty: qtyByPid.get(p.id) ?? 0,
    }));

    return NextResponse.json({ stocks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/stocks error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
