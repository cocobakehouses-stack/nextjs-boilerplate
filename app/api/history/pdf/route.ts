import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const loc = (url.searchParams.get('location') || 'ALL').toUpperCase();
  const date = url.searchParams.get('date') || '';
  if (!date) return NextResponse.json({ error: 'missing date' }, { status: 400 });

  // โหลดข้อมูลจาก /api/history
  const api = `${url.origin}/api/history?location=${encodeURIComponent(loc)}&date=${encodeURIComponent(date)}`;
  const res = await fetch(api, { cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ error: 'failed to load history' }, { status: 500 });
  const data = await res.json();
  const rows = data?.rows || [];
  const totals = data?.totals || null;

  // สร้าง PDF
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  // สะสม Buffer
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ---- เนื้อหา ----
  doc.fontSize(16).text(`End of Day – ${date}`);
  doc.moveDown(0.3);
  doc.fontSize(12).text(`Location: ${loc}`);
  doc.moveDown();

  const includeLoc = rows.some((r: any) => r.location) || loc === 'ALL';
  const header = includeLoc
    ? ['Location', 'Time', 'Bill', 'Qty', 'Payment', 'Total']
    : ['Time', 'Bill', 'Qty', 'Payment', 'Total'];

  doc.font('Helvetica-Bold').text(header.join('   |   '));
  doc.moveDown(0.2);
  doc.font('Helvetica').text(''.padEnd(120, '—'));
  doc.moveDown(0.3);

  for (const r of rows) {
    const cols = includeLoc
      ? [r.location ?? '', r.time ?? '', r.billNo ?? '', String(r.totalQty ?? 0), r.payment ?? '', Number(r.total ?? 0).toFixed(2)]
      : [r.time ?? '', r.billNo ?? '', String(r.totalQty ?? 0), r.payment ?? '', Number(r.total ?? 0).toFixed(2)];
    doc.text(cols.join('   |   '));
  }

  if (totals) {
    doc.moveDown();
    doc.text(''.padEnd(120, '—'));
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text(`Bills: ${totals.count}   |   Total Qty: ${totals.totalQty}`);
    doc.text(`Total Amount: ${Number(totals.totalAmount ?? 0).toFixed(2)} THB`);
    doc.text(`Freebies Amount: ${Number(totals.freebiesAmount ?? 0).toFixed(2)} THB`);
    if (totals.byPayment) {
      const byPay = Object.entries(totals.byPayment)
        .map(([k, v]) => `${k}: ${Number(v).toFixed(2)} THB`)
        .join(' | ');
      doc.text(`By Payment: ${byPay}`);
    }
  }

  doc.end();

  const buf = await done;                 // Node Buffer
  const bytes = Uint8Array.from(buf);     // แปลงเป็น Uint8Array (ปลอดภัยเรื่อง type)

  const filename = `history_${loc}_${date}.pdf`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      // 👇 สำคัญมาก
      'Content-Type': 'application/pdf',
      // ใช้ attachment เพื่อบังคับดาวน์โหลดและกำหนดชื่อไฟล์ให้ถูก .pdf
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
