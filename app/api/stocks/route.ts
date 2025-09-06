// app/api/stock/route.ts
// app/api/stocks/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  ensureSheetExists,               // ⬅️ เพิ่มอันนี้เข้ามา
  ensureSheetExistsIdempotent,      // ใช้กับ STOCKS เพื่อกันชื่อซ้ำ
} from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';
const PRODUCTS_TAB = 'PRODUCTS';
const a1 = (t:string) => `'${String(t).replace(/'/g,"''")}'`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').toUpperCase();
    if (!location) return NextResponse.json({ error:'location required' }, { status:400 });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const sheets = google.sheets({ version:'v4', auth: getAuth() });

    await ensureSheetExistsIdempotent(sheets, spreadsheetId, STOCKS_TAB);
    await ensureSheetExists(sheets, spreadsheetId, PRODUCTS_TAB);

    // read stocks
    const sRes = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${a1(STOCKS_TAB)}!A:D`,
    });
    const sRows = (sRes.data.values || []).slice(1); // loc,pid,qty,updatedAt

    // read products for names/prices
    const pRes = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${a1(PRODUCTS_TAB)}!A:C`,
    });
    const pRows = (pRes.data.values || []).slice(1); // id,name,price
    const pMap = new Map<number, {name:string; price:number}>();
    pRows.forEach(r => {
      const id = Number(r[0]); if (!Number.isFinite(id)) return;
      pMap.set(id, { name: r[1] || `#${id}`, price: Number(r[2]) || 0 });
    });

    const list = sRows
      .filter(r => (String(r[0]||'').toUpperCase() === location))
      .map(r => {
        const pid = Number(r[1]); const qty = Number(r[2]) || 0;
        const meta = pMap.get(pid) || { name:`#${pid}`, price:0 };
        return { productId: pid, name: meta.name, price: meta.price, qty };
      })
      .sort((a,b)=>a.productId-b.productId);

    return NextResponse.json({ stock: list }, { headers:{ 'Cache-Control':'no-store' }});
  } catch (e:any) {
    console.error('GET /api/stocks error', e?.message||e);
    return NextResponse.json({ error:'failed' }, { status:500 });
  }
}
