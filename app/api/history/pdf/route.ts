// app/api/history/pdf/route.ts
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------- helpers ----------
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

function toArrayBufferStrict(u8: Uint8Array): ArrayBuffer {
  // คัดลอกลง ArrayBuffer ใหม่ เพื่อให้แน่ใจว่าไม่ใช่ SharedArrayBuffer
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

async function renderPdf(builder: (doc: any) => void): Promise<Uint8Array> {
  const doc = new (PDFDocument as any)({ size: 'A4', margin: 36 });

  // เก็บชิ้นข้อมูลแบบ Uint8Array แล้วค่อย concat เอง
  const chunks: Uint8Array[] = [];
  const done = new Promise<void>((resolve, reject) => {
    doc.on('data', (c: any) => {
      // Buffer ใน Node เป็น Uint8Array อยู่แล้ว
      chunks.push(c instanceof Uint8Array ? new Uint8Array(c) : new TextEncoder().encode(String(c)));
    });
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  builder(doc);
  doc.end();
  await done;

  let len = 0;
  for (const c of chunks) len += c.byteLength;
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

// ---------- route ----------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || '';
    const loc  = (url.searchParams.get('location') || 'ALL').toUpperCase();

    if (!date) {
      // สร้าง PDF error message ให้เลย
      const bytes = await renderPdf((doc) => {
        doc.fontSize(16).text('End of Day – PDF');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('red').text('Error: missing date');
      });
      const ab = toArrayBufferStrict(bytes);
      return new Response(ab, {
        status: 400,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="history_error.pdf"',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ✅ เรียก /api/history แบบ in-process (ไม่ผ่านเครือข่าย => ไม่ติด 401)
    const { GET: historyGET } = await import('../route'); // app/api/history/route.ts
    const internalReq = new Request(
      `http://local/api/history?location=${encodeURIComponent(loc)}&date=${encodeURIComponent(date)}`,
      { headers: { Accept: 'application/json' } }
    );
    const resp = await (historyGET as (r: Request, ctx?: any) => Promise<Response>)(internalReq);
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      const bytes = await renderPdf((doc) => {
        doc.fontSize(16).text(`End of Day – ${date}`);
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('red').text(`Error: failed to load history (${resp.status})`);
        if (detail) {
          doc.moveDown(0.5).fillColor('black').text(detail.slice(0, 1000));
        }
      });
      const ab = toArrayBufferStrict(bytes);
      return new Response(ab, {
        status: 500,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="history_${loc}_${date}_error.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const data = await resp.json();
    const rows: Row[] = data?.rows || [];
    const totals: Totals | null = data?.totals || null;

    const includeLocCol = loc === 'ALL' || rows.some((r) => (r.location ?? '').trim() !== '');

    // วาด PDF แบบเรียบง่าย อ่านง่าย
    const bytes = await renderPdf((doc) => {
      doc.fontSize(16).fillColor('black').text(`End of Day – ${date}`);
      doc.moveDown(0.3);
      doc.fontSize(12).text(`Location: ${loc}`);
      doc.moveDown(0.6);

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
    });

    const ab = toArrayBufferStrict(bytes);
    const filename = `history_${loc}_${date}.pdf`;

    return new Response(ab, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`, // จะเปิดในแท็บได้ และกดดาวน์โหลดได้ชื่อไฟล์ถูก
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    // fallback: ส่ง PDF ที่มีข้อความ error กลับไป
    const bytes = await renderPdf((doc) => {
      doc.fontSize(16).text('End of Day – PDF');
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('red').text(`Unexpected error: ${e?.message || e}`);
    });
    const ab = toArrayBufferStrict(bytes);
    return new Response(ab, {
      status: 500,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="history_error.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  }
}
