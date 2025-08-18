// app/api/history/pdf/route.ts
import { NextResponse } from 'next/server';
import { ALLOWED_TABS, fetchHistory, toBangkokDateString } from '../../../lib/sheets';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// stream -> Buffer
function docToBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: any) => reject(err));
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    if (!ALLOWED_TABS.has(location)) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

    const { rows, totals } = await fetchHistory(spreadsheetId, location, date);

    // โหลดฟอนต์ไทย .ttf จากโปรเจกต์
    const fontPath = path.join(process.cwd(), 'app', 'fonts', 'NotoSansThai-Regular.ttf');
    const fontBuf = fs.readFileSync(fontPath);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.font(fontBuf).fontSize(16).text(`Coco Bakehouse – End of Day`, { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(12).text(`Location: ${location}    Date: ${date}`);
    doc.moveDown(0.5);

    const headers = ['Time','Bill','Items','Qty','Payment','Total'];
    const colX = [40, 100, 150, 420, 470, 540];

    doc.fontSize(11).fill('#ac0000');
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: i < headers.length - 1 }));
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#ac0000');
    doc.fill('#000');

    doc.moveDown(0.3);
    rows.forEach(r => {
      const y = doc.y;
      doc.text(r.time || '', colX[0], y, { width: colX[1]-colX[0]-6 });
      doc.text(r.billNo || '', colX[1], y, { width: colX[2]-colX[1]-6 });
      doc.text(r.items || '', colX[2], y, { width: colX[3]-colX[2]-6 });
      doc.text(String(r.totalQty || 0), colX[3], y, { width: colX[4]-colX[3]-6 });
      doc.text(r.payment || '', colX[4], y, { width: colX[5]-colX[4]-6 });
      doc.text((r.total || 0).toFixed(2), colX[5], y, { width: 60 });
      doc.moveDown(0.2);
    });

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#000');
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Bills: ${totals.count}   Total Qty: ${totals.totalQty}`);
    doc.text(`Total Amount: ${totals.totalAmount.toFixed(2)} THB`);
    const payments = Object.entries(totals.byPayment).map(([k, v]) => `${k}: ${v.toFixed(2)} THB`).join(' | ');
    if (payments) doc.text(`By Payment → ${payments}`);

   doc.end();
const buf = await docToBuffer(doc);
const fileName = `EOD_${location}_${date}.pdf`;

// ✅ ใช้ Uint8Array แทน Buffer/ArrayBuffer เพื่อให้ TypeScript ยอม
const uint8 = new Uint8Array(buf);

return new Response(uint8, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store',
  },
});

  } catch (e: any) {
    console.error('GET /api/history/pdf error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
