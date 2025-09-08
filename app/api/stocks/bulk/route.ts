// app/api/stocks/bulk/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOCKS_TAB = 'STOCKS';

function isAlreadyExistsError(e:any){ return /already exists/i.test(String(e?.message||'')); }
async function ensureTabExistsResilient(sheets:any, spreadsheetId:string, title:string){
  try{
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields:'sheets.properties.title' });
    if ((meta.data.sheets??[]).some((s:any)=>s?.properties?.title===title)) return;
  }catch{}
  try{
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody:{ requests:[{ addSheet:{ properties:{ title }}}]}});
  }catch(e:any){ if(!isAlreadyExistsError(e)) throw e; }
}
async function ensureHeader(sheets:any, spreadsheetId:string, title:string, header:string[], a1:string){
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${a1Sheet(title)}!${a1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values:[header] },
  });
}
const toInt=(x:any)=>{ const n=Number(String(x??'').replace(/,/g,'').trim()); return Number.isFinite(n)?Math.floor(n):0; };

export async function PATCH(req: Request){
  try{
    const { location, updates } = await req.json();
    const loc = String(location||'').trim().toUpperCase();
    const list: Array<{productId:number, qty:number}> = Array.isArray(updates) ? updates : [];
    if (!loc || list.length===0) return NextResponse.json({ error:'location & updates required' }, { status:400 });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version:'v4', auth });

    await ensureTabExistsResilient(sheets, spreadsheetId, STOCKS_TAB);
    await ensureHeader(sheets, spreadsheetId, STOCKS_TAB, ['Location','ProductID','Qty'], 'A1:C1');

    const sRes = await sheets.spreadsheets.values.get({ spreadsheetId, range:`${a1Sheet(STOCKS_TAB)}!A:C` });
    const sRows = (sRes.data.values||[]);
    const dataRows = sRows.slice(1);
    const idx = new Map<string, number>();
    dataRows.forEach((r:any[], i:number) => {
      const l = (r?.[0]??'').toString().trim().toUpperCase();
      const pid = toInt(r?.[1]);
      if (pid>0) idx.set(`${l}#${pid}`, i+2);
    });

    const updatesBatch: Array<{range:string, values:any[][]}> = [];
    const inserts: any[][] = [];

    for (const u of list) {
      const pid = toInt(u.productId);
      const qty = Math.max(0, toInt(u.qty));
      if (pid<=0) continue;
      const key = `${loc}#${pid}`;
      if (idx.has(key)) {
        const row = idx.get(key)!;
        updatesBatch.push({
          range: `${a1Sheet(STOCKS_TAB)}!C${row}:C${row}`,
          values: [[ qty ]],
        });
      } else {
        inserts.push([ loc, pid, qty ]);
      }
    }

    if (updatesBatch.length>0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody:{ valueInputOption:'USER_ENTERED', data: updatesBatch },
      });
    }
    if (inserts.length>0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${a1Sheet(STOCKS_TAB)}!A:C`,
        valueInputOption:'USER_ENTERED',
        insertDataOption:'INSERT_ROWS',
        requestBody:{ values: inserts },
      });
    }

    return NextResponse.json({ ok:true });
  }catch(e:any){
    console.error('PATCH /api/stocks/bulk error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status:500 });
  }
}
