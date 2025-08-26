// app/api/history/pdf/route.ts
import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const loc = (url.searchParams.get('location') || 'ALL').toUpperCase();
  const date = url.searchParams.get('date') || '';

  if (!date) {
    return NextResponse.json({ error: 'missing date' }, { status: 400 });
  }

  // โหลด data จาก /api/history ตามเดิม
  const api = `${url.origin}/api/history?location=${encodeURIComponent(loc)}&date=${encodeURIComponent(date)}`;
  const res = await fetch(api, { cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ error: 'failed to load history' }, { status: 500 });
  const data = await res.json();
  const rows = data?.rows || [];
  const totals = data?.totals || null;

  // สร้าง PDF
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  // เก็บ buffer (สำคัญ: ให้ได้ Node Buffer ก่อน)
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ---- เขียนเนื้อหา ----
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

  // รอให้ได้ Buffer เสร็จ
  const buf = await done;

  // แปลงเป็น Uint8Array แบบไม่ดึง .buffer (กัน SharedArrayBuffer)
  const bytes = Uint8Array.from(buf);

  // ตั้งชื่อไฟล์ (inline = เปิดในเบราว์เซอร์, ถ้าอยาก force ดาวน์โหลดใช้ attachment)
  const filename = `history_${loc}_${date}.pdf`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
