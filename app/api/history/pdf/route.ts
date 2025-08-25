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

const LOC_TAB = 'Locations'; // A: ID, B: Label

// รวม buffer จากสตรีมของ pdfkit เป็น Buffer เดียว
function docToBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: any) => reject(err));
  });
}

// ⬇️ type เสริมที่มีฟิลด์ location (ไว้ใช้เฉพาะกรณี ALL)
type LocalHistoryRow = HistoryRow & { location?: string };

// อ่านรายชื่อ Location IDs จากแท็บ Locations
async function listLocationIds(spreadsheetId: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureSheetExists(sheets, spreadsheetId, LOC_TAB);
  // header A1:B1 -> rows เริ่ม A2
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${LOC_TAB}!A:A` });
  const rows = (r.data.values || []).slice(1);
  return rows
    .map((x) => (x?.[0] || '').toString().trim().toUpperCase())
    .filter(Boolean);
}

// รวม totals ข้ามหลายสาขา (สำหรับ ALL)
function combineTotals(rows: LocalHistoryRow[]) {
  const result = {
    count: rows.length,
    totalQty: rows.reduce((s, r) => s + (Number(r.totalQty) || 0), 0),
    totalAmount: rows.reduce((s, r) => s + (Number(r.total) || 0), 0),
    freebiesAmount: rows.reduce((s, r) => s + (Number(r.freebiesAmount) || 0), 0),
    byPayment: {} as Record<string, number>,
  };
  for (const r of rows) {
    const key = (r.payment || '').toString();
    if (!key) continue;
    result.byPayment[key] = (result.byPayment[key] || 0) + (Number(r.total) || 0);
  }
  return result;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const location = (searchParams.get('location') || 'ORDERS').toUpperCase();
    const date = searchParams.get('date') || toBangkokDateString();

    const isAll = location === 'ALL';
    if (!isAll && !ALLOWED_TABS.has(location)) {
      return new Response(JSON.stringify({ error: 'Invalid location' }), { status: 400 });
    }

    // ดึงข้อมูล
    let rows: LocalHistoryRow[] = [];
    let totals:
      | {
          count: number;
          totalQty: number;
          totalAmount: number;
          freebiesAmount: number;
          byPayment: Record<string, number>;
        }
      | null = null;

    if (isAll) {
      const ids = await listLocationIds(spreadsheetId);
      const merged: LocalHistoryRow[] = [];
      for (const id of ids) {
        const { rows: r } = await fetchHistory(spreadsheetId, id, date);
        const withLoc = (r as HistoryRow[]).map<LocalHistoryRow>((x) => ({ ...x, location: id }));
        merged.push(...withLoc);
      }
      rows = merged;
      totals = combineTotals(rows);
    } else {
      const { rows: r, totals: t } = await fetchHistory(spreadsheetId, location, date);
      rows = r as LocalHistoryRow[]; // single-location ไม่มี location แต่ type รองรับได้
      totals = {
        count: t.count,
        totalQty: t.totalQty,
        totalAmount: t.totalAmount,
        freebiesAmount: t.freebiesAmount || 0,
        byPayment: t.byPayment || {},
      };
    }

    // ใช้ฟอนต์ UID_SPACE.ttf (ต้องวางไว้ที่ app/fonts/UID_SPACE.ttf)
    const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
    const fontPath = path.join(process.cwd(), 'app', 'fonts', 'UID_SPACE.ttf');
    (doc as any).registerFont('UID_SPACE', fontPath);
    (doc as any).font('UID_SPACE');

    const bufPromise = docToBuffer(doc);

    // Header
    doc.fontSize(16).text('Coco Bakehouse – End of Day', { align: 'left' });
    doc.moveDown(0.3);
    doc
      .fontSize(12)
      .text(`Location: ${isAll ? 'ALL' : location}    Date: ${date}`);
    doc.moveDown(0.5);

    // Table header
    const headers = isAll
      ? ['Loc', 'Time', 'Bill', 'Items', 'Qty', 'Pay', 'Total']
      : ['Time', 'Bill', 'Items', 'Qty', 'Payment', 'Total'];

    // กำหนดคอลัมน์ (A4: x เริ่ม ~40-555)
    const colX = isAll
      ? [40, 90, 140, 190, 460, 510, 560] // +1 คอลัมน์ "Loc"
      : [40, 100, 150, 420, 470, 540];

    doc.fontSize(11).fill('#ac0000');
    headers.forEach((h: string, i: number) => {
      doc.text(h, colX[i], doc.y, { continued: i < headers.length - 1 });
    });
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#ac0000');
    doc.fill('#000');

    // Rows
    doc.moveDown(0.3);
    rows.forEach((r) => {
      const y = doc.y;
      if (isAll) {
        doc.text(r.location || '', colX[0], y, { width: colX[1] - colX[0] - 6 });
        doc.text(r.time || '',      colX[1], y, { width: colX[2] - colX[1] - 6 });
        doc.text(r.billNo || '',    colX[2], y, { width: colX[3] - colX[2] - 6 });
        doc.text(r.items || '',     colX[3], y, { width: colX[4] - colX[3] - 6 });
        doc.text(String(r.totalQty ?? 0), colX[4], y, { width: colX[5] - colX[4] - 6 });
        doc.text(r.payment || '',   colX[5], y, { width: colX[6] - colX[5] - 6 });
        doc.text((r.total ?? 0).toFixed(2), colX[6], y, { width: 60 });
      } else {
        doc.text(r.time || '',      colX[0], y, { width: colX[1] - colX[0] - 6 });
        doc.text(r.billNo || '',    colX[1], y, { width: colX[2] - colX[1] - 6 });
        doc.text(r.items || '',     colX[2], y, { width: colX[3] - colX[2] - 6 });
        doc.text(String(r.totalQty ?? 0), colX[3], y, { width: colX[4] - colX[3] - 6 });
        doc.text(r.payment || '',   colX[4], y, { width: colX[5] - colX[4] - 6 });
        doc.text((r.total ?? 0).toFixed(2), colX[5], y, { width: 60 });
      }
      doc.moveDown(0.2);
    });

    // Totals
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#000');
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Bills: ${totals.count}   Total Qty: ${totals.totalQty}`);
    doc.text(`Total Amount: ${totals.totalAmount.toFixed(2)} THB`);
    doc.text(`Freebies Amount: ${(totals.freebiesAmount || 0).toFixed(2)} THB`);
    const payments = Object.entries(totals.byPayment || {})
      .map(([k, v]) => `${k}: ${(v as number).toFixed(2)} THB`)
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
