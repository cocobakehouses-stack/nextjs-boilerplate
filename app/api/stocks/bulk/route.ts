// app/api/stock/bulk/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BulkBody = { location: string; updates: Array<{productId:number; qty:number}> };

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(()=> ({})) as BulkBody;
    const location = (body.location || '').toUpperCase();
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (!location || updates.length === 0) {
      return NextResponse.json({ error:'invalid payload' }, { status:400 });
    }

    // เรียก /api/stocks/[productId]?location=... setTo=qty ทีละตัว
    const baseUrl = new URL(req.url);
    baseUrl.pathname = '/api/stocks/0'; // dummy, will replace

    for (const u of updates) {
      const url = new URL(baseUrl.toString());
      url.pathname = `/api/stocks/${u.productId}`;
      url.searchParams.set('location', location);
      const r = await fetch(url.toString(), {
        method:'PATCH',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify({ setTo: Number(u.qty)||0, reason:'bulk set' }),
        cache:'no-store',
      });
      if (!r.ok) {
        const msg = await r.text().catch(()=> '');
        return NextResponse.json({ error:`failed at productId ${u.productId}: ${msg}` }, { status:500 });
      }
    }

    return NextResponse.json({ ok:true });
  } catch (e:any) {
    console.error('PATCH /api/stock/bulk error', e?.message||e);
    return NextResponse.json({ error:'failed' }, { status:500 });
  }
}
