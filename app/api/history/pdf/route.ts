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
  const location = (url.searchParams.get('location') || '').toUpperCase();
  const date = url.searchParams.get('date') || '';

  if (!date) {
    return NextResponse.json({ error: 'missing date' }, { status: 400 });
  }

  // ดึง JSON จาก /api/history (self-fetch ต้องใช้ absolute URL)
  const api = `${url.origin}/api/history?location=${encodeURIComponent(
    location
  )}&date=${encodeURIComponent(date)}`;
  const res = await fetch(api, { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json({ error: 'failed to load history' }, { status: 500 });
  }

  const data = await res.json();
  const rows: Row[] = data?.rows || [];
  const totals: Totals | null = data?.totals || null;

  // helper: เขียน PDF ลง pdfkit แล้วสตรีมออกเป็น Web ReadableStream<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });

      // pipe node Buffer chunk -> web Uint8Array
      doc.on('data', (chunk: any) => {
        // chunk เป็น Buffer ของ Node; แปลงเป็น Uint8Array โดยไม่แตะ .buffer
        controller.enqueue(new Uint8Array(chunk));
      });
      doc.on('end', () => controller.close());
      doc.on('error', (err) => controller.error(err));

      // ----- เขียนเนื้อหา PDF -----
      doc.fontSize(16).text(`End of Day – ${date}`);
      doc.moveDown(0.3);
      doc.fontSize(12).text(`Location: ${location || '-'}`);
      doc.moveDown();

      const includeLocCol = rows.some((r) => r.location) || location === 'ALL';
      const header = includeLocCol
        ? ['Location', 'Time', 'Bill', 'Qty', 'Payment', 'Total']
        : ['Time', 'Bill', 'Qty', 'Payment', 'Total'];

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
              Number(r.total ?? 0).toFixed(2),
            ]
          : [
              r.time ?? '',
              r.billNo ?? '',
              String(r.totalQty ?? 0),
              r.payment ?? '',
              Number(r.total ?? 0).toFixed(2),
            ];
        doc.text(cols.join('   |   '));
      });

      if (totals) {
        doc.moveDown();
        doc.text(''.padEnd(120, '—'));
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text(
          `Bills: ${totals.count}   |   Total Qty: ${totals.totalQty}`
        );
        doc.text(`Total Amount: ${Number(totals.totalAmount ?? 0).toFixed(2)} THB`);
        doc.text(`Freebies Amount: ${Number(totals.freebiesAmount ?? 0).toFixed(2)} THB`);
        if (totals.byPayment) {
          const byPay = Object.entries(totals.byPayment)
            .map(([k, v]) => `${k}: ${Number(v).toFixed(2)} THB`)
            .join(' | ');
          doc.text(`By Payment: ${byPay}`);
        }
      }

      // ปิด doc เพื่อ trigger 'end'
      doc.end();
    },
  });

  // ส่งเป็นสตรีม พร้อม header ถูกต้อง (ไม่ตั้ง content-length เพราะเป็นสตรีม)
  const filename = `history_${location || 'NA'}_${date}.pdf`;
  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
