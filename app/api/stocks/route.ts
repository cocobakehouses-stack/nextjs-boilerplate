// app/api/stocks/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  a1Sheet,
  toBangkokDateString,
  ensureSheetExistsIdempotent,
} from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'PRODUCTS';         // A:ID, B:Name, C:Price
const STOCKS_TAB   = 'STOCKS';           // A:Location, B:ProductId, C:ProductName, D:Qty
const MOVE_TAB     = 'STOCK_MOVEMENTS';  // A:Date, B:Time, C:Location, D:ProductId, E:ProductName, F:Delta, G:Reason, H:User

type StockItem = { productId: number; name: string; price: number; qty: number };

function parseNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = String(url.searchParams.get('location') || '').trim().toUpperCase();
    const asOf = url.searchParams.get('asOf'); // YYYY-MM-DD (optional)

    if (!location) {
      return NextResponse.json({ error: 'missing location' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // make sure sheets exist (idempotent)
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, PRODUCTS_TAB, ['ID','Name','Price']);
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, STOCKS_TAB,   ['Location','ProductId','ProductName','Qty']);
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, MOVE_TAB,     ['Date','Time','Location','ProductId','ProductName','Delta','Reason','User']);

    // load products map (id -> {name, price})
    const prodRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(PRODUCTS_TAB)}!A:C`,
    });
    const prodRows = (prodRes.data.values || []).slice(1);
    const idToProd = new Map<number, { name: string; price: number }>();
    for (const r of prodRows) {
      const id = Number(r?.[0]);
      const name = String(r?.[1] ?? '').trim();
      const price = parseNum(r?.[2]);
      if (Number.isFinite(id) && name) idToProd.set(id, { name, price });
    }

    let stocks: StockItem[] = [];

    if (asOf) {
      // ===== Path A: compute as-of from MOVEMENTS =====
      // read all movements
      const mvRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${a1Sheet(MOVE_TAB)}!A:H`,
      });
      const mvRows = (mvRes.data.values || []).slice(1);

      // aggregate by product for this location where date <= asOf
      const agg = new Map<number, number>(); // productId -> qty
      for (const r of mvRows) {
        const date = String(r?.[0] ?? '').trim();       // A
        const loc  = String(r?.[2] ?? '').trim().toUpperCase(); // C
        const pid  = Number(r?.[3]);                    // D
        const delta= parseNum(r?.[5]);                  // F

        if (!date || !loc || !Number.isFinite(pid)) continue;
        if (loc !== location) continue;
        if (date > asOf) continue;

        agg.set(pid, (agg.get(pid) || 0) + delta);
      }

      // to array + join product meta
      stocks = Array.from(agg.entries())
        .map(([productId, qty]) => {
          const meta = idToProd.get(productId) || { name: `#${productId}`, price: 0 };
          return { productId, name: meta.name, price: meta.price, qty: Math.max(0, qty) };
        })
        .sort((a, b) => a.productId - b.productId);

    } else {
      // ===== Path B: read current snapshot from STOCKS =====
      const sRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${a1Sheet(STOCKS_TAB)}!A:D`,
      });
      const sRows = (sRes.data.values || []).slice(1);
      const list: StockItem[] = [];

      for (const r of sRows) {
        const loc = String(r?.[0] ?? '').trim().toUpperCase();
        if (loc !== location) continue;
        const productId = Number(r?.[1]);
        const name = String(r?.[2] ?? '').trim();
        const qty = parseNum(r?.[3]);
        const meta = idToProd.get(productId) || { name, price: 0 };
        list.push({
          productId,
          name: meta.name || name || `#${productId}`,
          price: meta.price,
          qty: Math.max(0, qty),
        });
      }

      // include products not in STOCKS yet (qty 0) — optional: comment out ifไม่ต้องการ
      for (const [pid, meta] of idToProd.entries()) {
        if (!list.some(x => x.productId === pid)) {
          list.push({ productId: pid, name: meta.name, price: meta.price, qty: 0 });
        }
      }

      stocks = list.sort((a, b) => a.productId - b.productId);
    }

    return NextResponse.json({ location, asOf: asOf || null, stocks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/stocks error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
