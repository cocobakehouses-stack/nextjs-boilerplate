// app/api/stock/csv/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const location = (url.searchParams.get('location')||'').toUpperCase();
    if (!location) return NextResponse.json({ error:'location required' }, { status:400 });

    // reuse JSON
    const jsonUrl = new URL(req.url); jsonUrl.pathname = '/api/stock';
    const r = await fetch(jsonUrl.toString(), { cache:'no-store' });
    if (!r.ok) return NextResponse.json({ error:'load stock failed' }, { status:500 });
    const { stock } = await r.json();

    const header = ['productId','name','price','qty'];
    const lines = [header.join(',')].concat(
      (stock || []).map((s:any) => [
        s.productId,
        `"${String(s.name||'').replace(/"/g,'""')}"`,
        s.price ?? 0,
        s.qty ?? 0,
      ].join(','))
    );
    const csv = lines.join('\n');

    return new NextResponse(csv, {
      headers:{
        'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="stock_${location}.csv"`,
        'Cache-Control':'no-store',
      }
    });
  } catch (e:any) {
    console.error('GET /api/stocks/csv error', e?.message||e);
    return NextResponse.json({ error:'failed' }, { status:500 });
  }
}
