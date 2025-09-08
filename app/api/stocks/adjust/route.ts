// app/api/stocks/adjust/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  getAuth,
  a1Sheet,
  toBangkokDateString,
  ensureSheetExistsIdempotent,
} from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'PRODUCTS';         // A:ID, B:Name, C:Price
const STOCKS_TAB   = 'STOCKS';           // A:Location, B:ProductId, C:ProductName, D:Qty
const MOVE_TAB     = 'STOCK_MOVEMENTS';  // A:Date, B:Time, C:Location, D:ProductId, E:ProductName, F:Delta, G:Reason, H:User

type AdjustItem = { productId: number; delta?: number; setTo?: number; reason?: string };

function fmtTimeBangkok(d = new Date()) {
  const t = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  return t.replace(/\./g, ':');
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const location = String(body?.location || '').trim().toUpperCase();
    const movements: AdjustItem[] = Array.isArray(body?.movements) ? body.movements : [];
    if (!location) return NextResponse.json({ error: 'missing location' }, { status: 400 });
    if (movements.length === 0) return NextResponse.json({ error: 'no movements' }, { status: 400 });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ ให้มีแท็บเสมอ (กันซ้ำได้จริง)
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, PRODUCTS_TAB, ['ID','Name','Price']);
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, STOCKS_TAB, ['Location','ProductId','ProductName','Qty']);
    await ensureSheetExistsIdempotent(sheets, spreadsheetId, MOVE_TAB, ['Date','Time','Location','ProductId','ProductName','Delta','Reason','User']);

    // 1) โหลด Products map
    const prodRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(PRODUCTS_TAB)}!A:C`,
    });
    const prodRows = (prodRes.data.values || []).slice(1);
    const idToName = new Map<number, string>();
    for (const r of prodRows) {
      const id = Number(r?.[0]);
      const name = String(r?.[1] ?? '').trim();
      if (Number.isFinite(id) && name) idToName.set(id, name);
    }

    // 2) โหลด STOCKS snapshot
    const stockRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(STOCKS_TAB)}!A:D`,
    });
    const stockRows = stockRes.data.values || [['Location','ProductId','ProductName','Qty']];

    // index: LOCATION#ID -> row number (1-based)
    const idx = new Map<string, number>();
    for (let i = 1; i < stockRows.length; i++) {
      const loc = String(stockRows[i]?.[0] ?? '').trim().toUpperCase();
      const pid = Number(stockRows[i]?.[1]);
      if (!loc || !Number.isFinite(pid)) continue;
      idx.set(`${loc}#${pid}`, i + 1);
    }

    const getQty = (row: any[]) => {
      const n = Number(String(row?.[3] ?? '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    // 3) คำนวณ upsert
    const upserts: Array<{ row: number; values: [string, number, string, number] }> = [];

    for (const mv of movements) {
      const pid = Number(mv.productId);
      if (!Number.isFinite(pid)) continue;
      const key = `${location}#${pid}`;
      const name = idToName.get(pid) ?? `#${pid}`;
      const existing = idx.get(key);

      if (existing) {
        const currentRow = stockRows[existing - 1] || [];
        const currentQty = getQty(currentRow);
        const next = typeof mv.setTo === 'number'
          ? Math.max(0, Math.floor(mv.setTo))
          : Math.max(0, currentQty + Math.floor(mv.delta || 0));
        upserts.push({ row: existing, values: [location, pid, name, next] });
      } else {
        const next = typeof mv.setTo === 'number'
          ? Math.max(0, Math.floor(mv.setTo))
          : Math.max(0, Math.floor(mv.delta || 0));
        const newRow = (stockRows.length + upserts.length + 1);
        idx.set(key, newRow);
        upserts.push({ row: newRow, values: [location, pid, name, next] });
      }
    }

    if (upserts.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: upserts.map(u => ({
            range: `${a1Sheet(STOCKS_TAB)}!A${u.row}:D${u.row}`,
            values: [u.values],
          })),
        },
      });
    }

    // 4) Append MOVEMENTS
    const now = new Date();
    const date = toBangkokDateString(now);
    const time = fmtTimeBangkok(now);
    const moves = movements.map(mv => {
      const pid = Number(mv.productId);
      const delta = typeof mv.setTo === 'number' ? Number(mv.setTo) : Number(mv.delta || 0);
      const name = idToName.get(pid) ?? `#${pid}`;
      return [date, time, location, pid, name, delta, String(mv.reason || 'adjust'), '-'];
    });

    if (moves.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${a1Sheet(MOVE_TAB)}!A:H`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: moves },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/stocks/adjust error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
