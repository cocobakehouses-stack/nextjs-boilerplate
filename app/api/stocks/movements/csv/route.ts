// app/api/stocks/movements/csv/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, a1Sheet } from '../../../../lib/sheets';

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

export async function GET(req: Request){
  try{
    const url = new URL(req.url);
    const location = (url.searchParams.get('location')||'').trim().toUpperCase();
    const start = (url.searchParams.get('start')||'').trim();
    const end   = (url.searchParams.get('end')||'').trim();
    if (!location || !start || !end) {
      return new NextResponse('location,start,end required', { status:400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const auth = getAuth();
    const sheets = google.sheets({ version:'v4', auth });

    await ensureTabExistsResilient(sheets, spreadsheetId, MOVEMENTS_TAB);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${a1Sheet(MOVEMENTS_TAB)}!A:H`,
    });
    const rows = (res.data.values || []).slice(1).filter((r:any[]) => {
      const loc = (r?.[2]??'').toString().trim().toUpperCase();
      const d = (r?.[0]??'').toString().trim();
      return loc === location && d >= start && d <= end;
    });

    const header = ['Date','Time','Location','ProductID','ProductName','Delta','Reason','User'];
    const csv = [header, ...rows].map(r =>
      r.map((c:any)=>{
        const s = String(c ?? '');
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(',')
    ).join('\n');

    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': `attachment; filename="movements_${location}_${start}_${end}.csv"`,
      }
    });
  }catch(e:any){
    console.error('GET /api/stocks/movements/csv error', e?.message || e);
    return new NextResponse('failed', { status:500 });
  }
}
