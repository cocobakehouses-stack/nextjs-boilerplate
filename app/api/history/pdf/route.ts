// app/api/history/pdf/route.ts
import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Totals = {
  count: number;
  totalQty: number;
  totalAmount: number;
  freebiesAmount: number;
  byPayment?: Record<string, number>;
};

type Row = {
  location?: string;
  time?: string;
  billNo?: string;
  totalQty?: number;
  payment?: string;
  total?: number;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const location = (url.searchParams.get('location') || 'ALL').toUpperCase();
  const date = url.searchParams.get('date') || '';

  if (!date) {
    return NextResponse.json({ error: 'missing date' }, { status: 400 });
  }

  // โหลด JSON จาก /api/history
  const api = `${url.origin}/api/history?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`;
  const res = await fetch(api, { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json({ error: 'failed to load history' }, { status: 500 });
  }

  const data = await res.json();
  const rows: Row[] = data?.rows || [];
  const totals: Totals | null = data?.totals || null;

  // สร้าง PDF
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  // เก็บ buffer
  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Header
  doc.fontSize(16).text(`End of Day – ${date}`);
  doc.moveDown(0.3);
  doc.fontSize(12).text(`Location: ${location || '-'}`);
  doc.moveDown();

  const includeLocCol = rows.some(r => r.location) || location === 'ALL';
  const header = includeLocCol
    ? ['Location','Time','Bill','Qty','Payment','Total']
    : ['Time','Bill','Qty','Payment','Total'];

  doc.font('Helvetica-Bold').text(header.join('   |   '));
  doc.moveDown(0.2);
  doc.font('Helvetica').text(''.padEnd(120, '—'));
  doc.moveDown(0.3);

  rows.forEach((r) => {
    const cols = includeLocCol
      ? [
          r.location ?? '',
          r.time ?? '',
          r.billNo ?? '',
          String(r.totalQty ?? 0),
          r.payment ?? '',
          (Number(r.total ?? 0)).toFixed(2),
        ]
      : [
          r.time ?? '',
          r.billNo ?? '',
          String(r.totalQty ?? 0),
          r.payment ?? '',
          (Number(r.total ?? 0)).toFixed(2),
        ];
    doc.text(cols.join('   |   '));
  });

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
  const pdfBuffer = await bufferPromise;

  // ✅ ส่งเป็น Blob (ปลอดภัยเรื่อง type: ไม่ติด SharedArrayBuffer)
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'no-store',
      // ตั้งชื่อไฟล์เวลาเปิด/ดาวน์โหลด
      // 'content-disposition': `inline; filename="history_${location}_${date}.pdf"`,
    },
  });

  // หรือถ้าชอบ Uint8Array:
  // const body = new Uint8Array(pdfBuffer);
  // return new NextResponse(body, {
  //   status: 200,
  //   headers: { 'content-type': 'application/pdf', 'cache-control': 'no-store' },
  // });
}
