// app/api/stocks/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  ensureSheetExistsIdempotent, // ✅ ใช้ตัว idempotent เท่านั้น
} from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';
const PRODUCTS_TAB = 'PRODUCTS';

function a1(title: string) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

// แปลงเลขแบบปลอดภัย
function n(x: any) {
  const v = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(v) ? v : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location') || '').toUpperCase();
    if (!location) {
      return NextResponse.json({ error: 'missing location' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ ให้แน่ใจว่ามีทั้งสองแท็บแบบไม่เพิ่มซ้ำ
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, STOCKS_TAB);
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, PRODUCTS_TAB);

    // อ่าน PRODUCTS: สมมติคอลัมน์ A:id, B:name, C:price
    const pRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1(PRODUCTS_TAB)}!A:C`,
    });
    const pRows = (pRes.data.values || []).slice(1); // skip header
    const products = pRows.map((r: any[]) => ({
      id: n(r?.[0]),
      name: (r?.[1] ?? '').toString().trim(),
      price: n(r?.[2]),
    })).filter(p => p.id);

    // อ่าน STOCKS (movement log): สมมติคอลัมน์ A:Date, B:Time, C:Location, D:ProductId, E:ProductName, F:Delta, G:Reason, H:User
    const sRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1(STOCKS_TAB)}!A:H`,
    });
    const sRows = (sRes.data.values || []).slice(1);

    // สรุปยอดคงเหลือตาม location = sum(delta)
    const byPid = new Map<number, number>();
    for (const r of sRows) {
      const loc = (r?.[2] ?? '').toString().trim().toUpperCase();
      if (loc !== location) continue;
      const pid = n(r?.[3]);
      const delta = n(r?.[5]);
      if (!pid) continue;
      byPid.set(pid, (byPid.get(pid) || 0) + delta);
    }

    // คืนรูปแบบเดิม { productId, name, price, qty }
    const stocks = products.map(p => ({
      productId: p.id,
      name: p.name,
      price: p.price,
      qty: Math.max(0, byPid.get(p.id) || 0),
    }));

    return NextResponse.json({ location, stocks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/stocks error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
