// app/api/stocks/movements/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../../lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(req: Request){
  try{
    const url = new URL(req.url);
    const location = (url.searchParams.get('location')||'').trim().toUpperCase();
    const start = (url.searchParams.get('start')||'').trim();
    const end   = (url.searchParams.get('end')||'').trim();
    if (!location || !start || !end) return NextResponse.json({ movements: [] });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version:'v4', auth });

    await ensureTabExistsResilient(sheets, spreadsheetId, MOVEMENTS_TAB);
    await ensureHeader(sheets, spreadsheetId, MOVEMENTS_TAB, ['Date','Time','Location','ProductID','ProductName','Delta','Reason','User'], 'A1:H1');

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(MOVEMENTS_TAB)}!A:H`,
    });
    const rows = (res.data.values || []).slice(1);
    const list = rows.map((r:any[], i:number) => ({
      id: String(i+1),
      date: (r?.[0]??'').toString().trim(),
      time: (r?.[1]??'').toString().trim(),
      location: (r?.[2]??'').toString().trim().toUpperCase(),
      productId: Number((r?.[3]??0)),
      productName: (r?.[4]??'').toString().trim(),
      delta: Number((r?.[5]??0)) || 0,
      reason: (r?.[6]??'').toString().trim(),
      user: (r?.[7]??'').toString().trim(),
    })).filter(r => r.location === location && r.date >= start && r.date <= end);

    // เรียงใหม่ -> เก่า
    list.sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    return NextResponse.json({ movements: list }, { headers:{ 'Cache-Control':'no-store' } });
  }catch(e:any){
    console.error('GET /api/stocks/movements error', e?.message || e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status:500 });
  }
}
