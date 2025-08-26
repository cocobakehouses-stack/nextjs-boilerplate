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

// --- helpers ---
function pdfFromBuffers(make: (doc: InstanceType<typeof PDFDocument>) => void) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Uint8Array.from(Buffer.concat(chunks))));
    doc.on('error', reject);
  });
  make(doc);
  doc.end();
  return done;
}

// บังคับให้เป็น ArrayBuffer (เลี่ยง SharedArrayBuffer)
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function sendPdf(bytes: Uint8Array, filename: string) {
  const ab = toArrayBuffer(bytes);
  const blob = new Blob([ab], { type: 'application/pdf' });
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      // inline = เปิดในเบราว์เซอร์, เปลี่ยนเป็น attachment ถ้าอยากบังคับดาวน์โหลด
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'Content-Length': String(bytes.byteLength),
    },
  });
}

function renderErrorPage(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  details?: Record<string, any>
) {
  doc.fontSize(16).text(title);
  doc.moveDown();
  doc.fontSize(12);
  if (details) {
    Object.entries(details).forEach(([k, v]) => {
      doc.text(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    });
  }
}

// --- route ---
export async function GET(req: Request) {
  const url = new URL(req.url);
  const loc = (url.searchParams.get('location') || 'ALL').toUpperCase();
  const date = url.searchParams.get('date') || '';
  const filename = `history_${loc}_${date || 'unknown'}.pdf`;

  if (!date) {
    const bytes = await pdfFromBuffers((doc) => {
      renderErrorPage(doc, 'Error: missing date', { location: loc });
    });
    return sendPdf(bytes, filename);
  }

  // ดึง JSON จาก /api/history
  const api = `${url.origin}/api/history?location=${encodeURIComponent(
    loc
  )}&date=${encodeURIComponent(date)}`;

  let rows: Row[] = [];
  let totals: Totals | null = null;

  try {
    const res = await fetch(api, { cache: 'no-store' });
    if (!res.ok) {
      const bytes = await pdfFromBuffers((doc) => {
        renderErrorPage(doc, 'Error: failed to load history', {
          location: loc,
          date,
          status: res.status,
        });
      });
      return sendPdf(bytes, filename);
    }
    const data = await res.json();
    rows = data?.rows || [];
    totals = data?.totals || null;
  } catch (e: any) {
    const bytes = await pdfFromBuffers((doc) => {
      renderErrorPage(doc, 'Error: exception while loading history', {
        location: loc,
        date,
        message: e?.message || String(e),
      });
    });
    return sendPdf(bytes, filename);
  }

  // สร้างรายงานปกติ
  const bytes = await pdfFromBuffers((doc) => {
    doc.fontSize(16).text(`End of Day – ${date}`);
    doc.moveDown(0.3);
    doc.fontSize(12).text(`Location: ${loc}`);
    doc.moveDown();

    const includeLocCol = rows.some((r) => r.location) || loc === 'ALL';
    const header = includeLocCol
      ? ['Location', 'Time', 'Bill', 'Qty', 'Payment', 'Total']
      : ['Time', 'Bill', 'Qty', 'Payment', 'Total'];

    doc.font('Helvetica-Bold').text(header.join('   |   '));
    doc.moveDown(0.2);
    doc.font('Helvetica').text(''.padEnd(120, '—'));
    doc.moveDown(0.3);

    for (const r of rows) {
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

    if (!rows.length) {
      doc.moveDown();
      doc.font('Helvetica-Oblique').text('No data for the selected date/location.');
    }
  });

  return sendPdf(bytes, filename);
}
