// app/api/stocks/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'PRODUCTS';
const STOCKS_TAB = 'STOCKS';

/** กลืน error: "A sheet with the name ... already exists" */
function isAlreadyExistsError(e: any) {
  const msg = (e?.message || '').toString();
  return /already exists/i.test(msg);
}

/** พยายาม addSheet แต่ถ้ามีอยู่แล้วให้ผ่าน (idempotent แบบ harden) */
async function ensureTabExistsResilient(
  sheets: any,
  spreadsheetId: string,
  title: string
) {
  try {
    // ลองอ่าน metadata ก่อน (ถ้าอ่านได้และเจอ ชีตก็ข้าม addSheet ไปเลย)
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const exists = (meta.data.sheets ?? []).some(
      (s: any) => s?.properties?.title === title
    );
    if (exists) return;
  } catch {
    // ถ้าอ่าน meta ไม่ได้ เราจะ fallthrough ไปลอง addSheet แล้วจับ error ด้านล่าง
  }

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  } catch (e: any) {
    if (!isAlreadyExistsError(e)) throw e; // ไม่ใช่ซ้ำจริงๆ ค่อยโยนต่อ
  }
}

/** เซ็ต header (เรียกกี่ครั้งก็ได้ ปลอดภัย) */
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
 * -> { stocks: [{productId, name, price, qty}] }
 *
 * PRODUCTS: A:ID, B:Name, C:Price
 * STOCKS  : A:Location, B:ProductID, C:Qty
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

    // ✅ ทำให้แท็บมีแน่ (ถ้ามีอยู่แล้ว จะกลืน error)
    await ensureTabExistsResilient(sheets, spreadsheetId, PRODUCTS_TAB);
    await ensureTabExistsResilient(sheets, spreadsheetId, STOCKS_TAB);

    // ✅ header ปลอดภัย เรียกซ้ำได้
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

    // อ่าน STOCKS
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

    // join
    const stocks = products.map((p) => ({
      productId: p.id,
      name: p.name,
      price: p.price,
      qty: qtyByPid.get(p.id) ?? 0,
    }));

    return NextResponse.json(
      { stocks },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('GET /api/stocks error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
