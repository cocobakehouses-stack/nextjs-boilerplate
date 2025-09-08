// app/api/stocks/adjust/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTS_TAB = 'PRODUCTS';
const STOCKS_TAB = 'STOCKS';
const MOVEMENTS_TAB = 'STOCK_MOVEMENTS';

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
const toNum=(x:any)=>{ const n=Number(String(x??'').replace(/,/g,'').trim()); return Number.isFinite(n)?n:0; };
const nowInBangkok = () => {
  const d = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(/\./g, ':');
  return { date, time };
};

export async function PATCH(req: Request){
  try{
    const { location, movements } = await req.json();
    const loc = String(location||'').trim().toUpperCase();
    const list: Array<{productId:number, delta?:number, setTo?:number, reason?:string, user?:string}> = Array.isArray(movements)?movements:[];
    if(!loc || list.length===0) return NextResponse.json({ error:'location & movements required' }, { status:400 });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version:'v4', auth });

    await Promise.all([
      ensureTabExistsResilient(sheets, spreadsheetId, PRODUCTS_TAB),
      ensureTabExistsResilient(sheets, spreadsheetId, STOCKS_TAB),
      ensureTabExistsResilient(sheets, spreadsheetId, MOVEMENTS_TAB),
    ]);

    await ensureHeader(sheets, spreadsheetId, PRODUCTS_TAB,  ['ID','Name','Price'], 'A1:C1');
    await ensureHeader(sheets, spreadsheetId, STOCKS_TAB,    ['Location','ProductID','Qty'], 'A1:C1');
    await ensureHeader(sheets, spreadsheetId, MOVEMENTS_TAB, ['Date','Time','Location','ProductID','ProductName','Delta','Reason','User'], 'A1:H1');

    // map products for name lookup
    const pRes = await sheets.spreadsheets.values.get({ spreadsheetId, range:`${a1Sheet(PRODUCTS_TAB)}!A:C`});
    const prodRows = (pRes.data.values||[]).slice(1);
    const nameByPid = new Map<number,string>();
    for(const r of prodRows){
      const pid = toInt(r?.[0]); if (pid>0) nameByPid.set(pid, (r?.[1]??'').toString().trim());
    }

    // load current stocks
    const sRes = await sheets.spreadsheets.values.get({ spreadsheetId, range:`${a1Sheet(STOCKS_TAB)}!A:C`});
    const sRows = (sRes.data.values||[]);
    const dataRows = sRows.slice(1);
    // index by (loc#pid) -> rowIndex (1-based with header)
    const idx = new Map<string, number>();
    const curQty = new Map<string, number>();
    dataRows.forEach((r:any[], i:number) => {
      const l = (r?.[0]??'').toString().trim().toUpperCase();
      const pid = toInt(r?.[1]);
      const key = `${l}#${pid}`;
      if (pid>0) {
        idx.set(key, i+2); // +1 header, +1 to convert 0->1-based
        curQty.set(key, toInt(r?.[2]));
      }
    });

    const updates: Array<{range:string, values:any[][]}> = [];
    const inserts: any[][] = [];
    const mvAppends: any[][] = [];
    const { date, time } = nowInBangkok();

    for(const m of list){
      const pid = toInt(m.productId);
      if (pid<=0) continue;
      const key = `${loc}#${pid}`;
      const current = curQty.get(key) ?? 0;
      const next = (typeof m.setTo === 'number' && m.setTo >= 0)
        ? Math.floor(m.setTo)
        : Math.max(0, current + (toInt(m.delta) || 0));

      if (idx.has(key)) {
        const row = idx.get(key)!;
        updates.push({
          range: `${a1Sheet(STOCKS_TAB)}!C${row}:C${row}`,
          values: [[ next ]],
        });
      } else {
        inserts.push([ loc, pid, next ]);
      }

      // movement log (delta หาก setTo ให้เก็บ (next-current))
      const deltaLogged = (typeof m.setTo === 'number') ? (next - current) : (toInt(m.delta) || 0);
      mvAppends.push([
        date, time, loc, pid, nameByPid.get(pid) ?? '', deltaLogged, (m.reason ?? '').toString(), (m.user ?? '').toString(),
      ]);
    }

    // apply updates
    if (updates.length>0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    }
    if (inserts.length>0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${a1Sheet(STOCKS_TAB)}!A:C`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: inserts },
      });
    }
    if (mvAppends.length>0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${a1Sheet(MOVEMENTS_TAB)}!A:H`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: mvAppends },
      });
    }

    return NextResponse.json({ ok:true });
  }catch(e:any){
    console.error('PATCH /api/stocks/adjust error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status:500 });
  }
}
