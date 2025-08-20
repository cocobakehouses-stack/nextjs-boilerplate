// app/api/products/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ตั้งชื่อแท็บเมนูในชีต (แก้ได้ตามที่ใช้จริง)
const PRODUCTS_TAB = 'Products'; // คาดหวัง header: A: Name, B: Price

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ดึงทั้งแผ่น
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:B`,
    });
    const rows = (res.data.values || []).slice(1); // ข้าม header

    // map -> {id, name, price} + กรองช่องว่าง + แปลงราคาเป็น number
    const products = rows
      .map((r, idx) => {
        const name = (r[0] || '').toString().trim();
        const price = Number((r[1] || '').toString().replace(/,/g, ''));
        return name && Number.isFinite(price) && price > 0
          ? { id: idx + 1, name, price }
          : null;
      })
      .filter(Boolean) as { id: number; name: string; price: number }[];

    // จัดเรียงราคาสูง -> ต่ำ เหมือนที่หน้า POS เคยทำ
    products.sort((a, b) => b.price - a.price);

    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('GET /api/products error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}