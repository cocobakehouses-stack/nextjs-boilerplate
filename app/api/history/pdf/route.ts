// app/api/history/pdf/route.ts
import PDFDocument from 'pdfkit';
import path from 'path';
import { google } from 'googleapis';
import {
  ALLOWED_TABS,
  fetchHistory,
  toBangkokDateString,
  getAuth,
  ensureSheetExists,
  type HistoryRow,
} from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOC_TAB = 'Locations';

function docToBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: any) => reject(err));
  });
}

async function listLocationIds(spreadsheetId: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureSheetExists(sheets, spreadsheetId, LOC_TAB);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${LOC_TAB}!A:A` });
  const rows = (r.data.values || []).slice(1);
  return rows.map(x => (x?.[0] || '').toString().trim().toUpperCase()).filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    if (location !== 'ALL' && !ALLOWED_TABS.has(location)) {
      return new Response(JSON.stringify({ error: 'Invalid location' }), { status: 400 });
    }

    // เตรียม PDF + ฟอนต์ไทย
    const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
    const fontPath = path.join(process.cwd(), 'app', 'fonts', 'UID_SPACE.ttf');
    (doc as any).registerFont('UID_SPACE', fontPath);
    (doc as any).font('UID_SPACE');
    const bufPromise = docToBuffer(doc);

    // Header
    doc.fontSize(16).text('Coco Bakehouse – End of Day', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(12).text(`Location: ${location === 'ALL' ? 'ALL' : location}    Date: ${date}`);
    doc.moveDown(0.5);

    // Table header
    const isAll = location === 'ALL';
    const headers = isAll
      ? ['Location', 'Time', 'Bill', 'Items', 'Qty', 'Payment', 'Total']
      : ['Time', 'Bill', 'Items', 'Qty', 'Payment', 'Total'];

    // คอลัมน์: เผื่อพื้นที่กรณี ALL (เพิ่ม Location)
    const colX = isAll
      ? [40, 110, 170, 220, 470, 520, 570] // Loc, Time, Bill, Items, Qty, Payment, Total
      : [40, 100, 150, 420, 470, 540];     // Time, Bill, Items, Qty, Payment, Total

    doc.fontSize(11).fill('#ac0000');
    headers.forEach((h: string, i: number) => {
      doc.text(h, colX[i], doc.y, { continued: i < headers.length - 1 });
    });
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#ac0000');
    doc.fill('#000');
    doc.moveDown(0.3);

    // ดึงข้อมูล
    let allRows: HistoryRow[] = [];
    if (isAll) {
      const ids = await listLocationIds(spreadsheetId);
      for (const id of ids) {
        const { rows } = await fetchHistory(spreadsheetId, id, date);
        const list = (rows as HistoryRow[]).map(r => ({ ...r, location: id }));
        allRows.push(...list);
      }
      // sort เวลา
      allRows.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    } else {
      const { rows } = await fetchHistory(spreadsheetId, location, date);
      allRows = rows as HistoryRow[];
    }

    // วาดแถว
    for (const r of allRows) {
      const y = doc.y;
      if (isAll) {
        doc.text(r.location || '', colX[0], y, { width: colX[1] - colX[0] - 6 });
        doc.text(r.time || '',     colX[1], y, { width: colX[2] - colX[1] - 6 });
        doc.text(r.billNo || '',   colX[2], y, { width: colX[3] - colX[2] - 6 });
        doc.text(r.items || '',    colX[3], y, { width: colX[4] - colX[3] - 6 });
        doc.text(String(r.totalQty ?? 0), colX[4], y, { width: colX[5] - colX[4] - 6 });
        doc.text(r.payment || '',  colX[5], y, { width: colX[6] - colX[5] - 6 });
        doc.text((r.total ?? 0).toFixed(2), 540, y, { width: 60 });
      } else {
        doc.text(r.time || '',     colX[0], y, { width: colX[1] - colX[0] - 6 });
        doc.text(r.billNo || '',   colX[1], y, { width: colX[2] - colX[1] - 6 });
        doc.text(r.items || '',    colX[2], y, { width: colX[3] - colX[2] - 6 });
        doc.text(String(r.totalQty ?? 0), colX[3], y, { width: colX[4] - colX[3] - 6 });
        doc.text(r.payment || '',  colX[4], y, { width: colX[5] - colX[4] - 6 });
        doc.text((r.total ?? 0).toFixed(2), colX[5], y, { width: 60 });
      }
      doc.moveDown(0.2);
    }

    // สรุปรวม (คำนวณเองสำหรับ ALL / ดึง totals เดียวสำหรับ single ก็โอเค แต่เพื่อความง่ายใช้รวมเอง)
    const sum = {
      count: allRows.length,
      totalQty: allRows.reduce((s, r) => s + (r.totalQty || 0), 0),
      totalAmount: allRows.reduce((s, r) => s + (r.total || 0), 0),
      freebiesAmount: allRows.reduce((s, r) => s + (r.freebiesAmount || 0), 0),
      byPayment: allRows.reduce((acc, r) => {
        const k = r.payment || '-';
        acc[k] = (acc[k] || 0) + (r.total || 0);
        return acc;
      }, {} as Record<string, number>),
    };

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#000');
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Bills: ${sum.count}   Total Qty: ${sum.totalQty}`);
    doc.text(`Total Amount: ${sum.totalAmount.toFixed(2)} THB`);
    doc.text(`Freebies Amount: ${sum.freebiesAmount.toFixed(2)} THB`);
    const payments = Object.entries(sum.byPayment)
      .map(([k, v]) => `${k}: ${v.toFixed(2)} THB`)
      .join(' | ');
    if (payments) doc.text(`By Payment → ${payments}`);

    doc.end();
    const buf = await bufPromise;

    const fileName = isAll ? `EOD_ALL_${date}.pdf` : `EOD_${location}_${date}.pdf`;
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('GET /api/history/pdf error', e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), { status: 500 });
  }
}
