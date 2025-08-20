// app/api/products/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'Products'; // A: id, B: name, C: price

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ให้แน่ใจว่ามีหัวคอลัมน์ A1:C1 (ถ้าไม่มีจะเขียนทับเฉพาะหัว)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A1:C1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['id', 'name', 'price']] },
    });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:C`,
    });

    const rows = (res.data.values || []).slice(1);
    const products = rows
      .map((r, idx) => {
        const id = Number((r[0] ?? '').toString().trim());
        const name = (r[1] ?? '').toString().trim();
        const price = Number((r[2] ?? '').toString().replace(/,/g, ''));
        return {
          id: Number.isFinite(id) ? id : idx + 1, // fallback id
          name,
          price: Number.isFinite(price) ? price : 0,
        };
      })
      .filter(p => p.name && p.price > 0);

    // จัดเรียงราคาสูง → ต่ำ (ให้ UI ได้ลำดับพร้อมใช้)
    products.sort((a, b) => b.price - a.price);

    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}