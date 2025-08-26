// app/api/products/[id]/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
// 👇 ปรับ path ให้ตรงโปรเจ็กต์ของหมวย (ถ้า lib/sheets อยู่ที่ app/api/lib/sheets จริง ให้ใช้แบบนี้)
import { getAuth } from 'app/lib/sheets.ts/lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'Products';

function parseNum(x: any) {
  const n = Number(String(x ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

export async function PATCH(req: Request, context: any) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Missing GOOGLE_SHEETS_ID' }, { status: 500 });
    }

    // ✅ ดึง id แบบปลอดภัย ไม่ผูก type context ให้ Next โวย
    const { id } = (context?.params ?? {}) as { id?: string };
    const idNum = parseNum(id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body?.active !== 'boolean') {
      return NextResponse.json({ error: 'active must be boolean' }, { status: 400 });
    }
    const active: boolean = body.active;

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // อ่านทั้งชีต
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCTS_TAB}!A:D`,
    });
    const values: (string | number)[][] = res.data.values ?? [];

    // หา row ที่ ID ตรง (data เริ่มแถวที่ 2 เพราะแถว 1 เป็น header)
    let rowIndex = -1; // index ในอาร์เรย์ values (0 คือ header, 1 คือแถวที่ 2 จริงในชีต)
    for (let i = 1; i < values.length; i++) {
      if (parseNum(values[i]?.[0]) === idNum) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // ✅ แก้ off-by-one: แถวจริงในชีต = rowIndex + 1 (1-based)
    const rowNumber = rowIndex + 1;
    const range = `${PRODUCTS_TAB}!D${rowNumber}:D${rowNumber}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[active ? 'TRUE' : 'FALSE']] },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/products/[id] error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
