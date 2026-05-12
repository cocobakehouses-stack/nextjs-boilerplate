'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import Link from 'next/link';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products';
import {
  ShoppingCart, Trash2, Plus, Minus, Home as HomeIcon,
  CreditCard, Smartphone, Truck, ChevronDown, ChevronUp, Gift
} from "lucide-react";

export const dynamic = 'force-dynamic';

/* ========== Types ========== */
type Product = { id: number; name: string; price: number; category?: string };
type CartItem = Product & { quantity: number };
type FreebieItem = { id: number; name: string; qty: number; price?: number };
type Step = 'cart' | 'confirm' | 'success';

/* ========== Helpers ========== */
const TZ = 'Asia/Bangkok';
function toDateString(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
function toTimeString(d: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d).replace(/\./g, ':');
}

/* ========== Global Styles & Animations ========== */
function GlobalAnimStyles() {
  return (
    <style jsx global>{`
      @keyframes cart-bump { 0%{transform:scale(1)} 20%{transform:scale(1.06)} 60%{transform:scale(0.98)} 100%{transform:scale(1)} }
      .animate-bump { animation: cart-bump 320ms ease; }
      @keyframes pop-added { 0%{transform:scale(1)} 30%{transform:scale(1.05)} 100%{transform:scale(1)} }
      .animate-pop { animation: pop-added 300ms ease; }
      @keyframes dash { to { stroke-dashoffset: 0; } }
      @keyframes scale-pop { 0%{ transform: scale(.8); opacity:0 } 80%{ transform: scale(1.08); opacity:1 } 100%{ transform: scale(1) } }
      @keyframes fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .fade-up { animation: fade-up .5s ease forwards; opacity: 0; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );
}

function AnimatedCheck({ size = 84 }: { size?: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="mx-auto" style={{ animation: 'scale-pop 400ms ease both' }}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c} style={{ animation: 'dash 200ms ease cubic-bezier' }} />
      <path d="M26 41 L36 50 L54 30" fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" style={{ animation: 'dash 400ms 300ms ease forwards' }} />
    </svg>
  );
}

/* ========== Main Component ========== */
export default function POSPage() {
  const [location, setLocation] = useState<LocationId | null>(null);
  const [step, setStep] = useState<Step>('cart');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [freebies, setFreebies] = useState<FreebieItem[]>([]);
  const [payment, setPayment] = useState<'cash' | 'promptpay' | 'lineman' | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [activeCat, setActiveCat] = useState<string>('All');
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [addedMap, setAddedMap] = useState<Record<number, boolean>>({});
  const [addedFreeMap, setAddedFreeMap] = useState<Record<number, boolean>>({});
  const [cartBump, setCartBump] = useState<number>(0);
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<any>(null);

  // Restore location from local storage
  useEffect(() => {
    try {
      const saved = (localStorage.getItem('pos_location') as LocationId | null) || null;
      if (saved) setLocation(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (location) {
      try { localStorage.setItem('pos_location', location); } catch {}
    }
  }, [location]);

  // Load Products
  async function reloadProducts() {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: Product[] = data?.products || [];
      setProducts(list.length > 0 ? list : FALLBACK_PRODUCTS);
    } catch {
      setProducts(FALLBACK_PRODUCTS);
    } finally {
      setLoadingProducts(false);
    }
  }
  useEffect(() => { reloadProducts(); }, []);

  // Category Logic
  const categories = useMemo(() => {
    const map = new Map<string, Product[]>();
    products.forEach(p => {
      const cat = p.category?.trim() || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    const keys = Array.from(map.keys()).sort();
    return [{ name: 'All', items: products }, ...keys.map(k => ({ name: k, items: map.get(k)! }))];
  }, [products]);

  const displayProducts = useMemo(() => {
    const found = categories.find(c => c.name === activeCat);
    return found ? found.items : products;
  }, [categories, activeCat, products]);

  // Cart Operations
  const addToCart = useCallback((p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { ...p, quantity: 1 }];
    });
    setAddedMap((m) => ({ ...m, [p.id]: true }));
    setTimeout(() => setAddedMap(m => { const c = {...m}; delete c[p.id]; return c; }), 700);
    setCartBump(n => n + 1);
  }, []);

  const addFreebie = useCallback((p: Product) => {
    setFreebies(prev => {
      const idx = prev.findIndex(f => f.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: p.id, name: p.name, qty: 1, price: p.price }];
    });
    setAddedFreeMap((m) => ({ ...m, [p.id]: true }));
    setTimeout(() => setAddedFreeMap(m => { const c = {...m}; delete c[p.id]; return c; }), 700);
    setCartBump(n => n + 1);
  }, []);

  const changeQty = (id: number, q: number) => {
    setCart(prev => q <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: q } : i));
  };
  const changeFreeQty = (id: number, q: number) => {
    setFreebies(prev => q <= 0 ? prev.filter(f => f.id !== id) : prev.map(f => f.id === id ? { ...f, qty: q } : f));
  };

  // Totals
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const freebiesAmount = useMemo(() => freebies.reduce((s, f) => s + (f.price || 0) * f.qty, 0), [freebies]);
  const grandTotal = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const freebiesQty = useMemo(() => freebies.reduce((s, f) => s + f.qty, 0), [freebies]);

  // Save Logic
  async function saveBill() {
    if (!location || !payment) return alert("กรุณาเลือกสถานที่และวิธีชำระเงิน");
    setSubmitting(true);
    try {
      const payload = {
        location, date: toDateString(new Date()), time: toTimeString(new Date()), payment,
        items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        freebies: freebies.map(f => ({ name: f.name, qty: f.qty, price: f.price || 0 })),
        subtotal, total: grandTotal, freebiesAmount, linemanDiscount: discount
      };
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setLastSaved({ ...payload, billNo: data.saved?.billNo, freebiesQty });
      setStep('success');
      setCart([]); setFreebies([]); setPayment(null); setDiscount(0);
    } catch (e: any) { alert(e.message); } finally { setSubmitting(false); }
  }

  /* ========== Step Success ========== */
  if (step === 'success' && lastSaved) {
    return (
      <main className="min-h-screen bg-[#fffff0] flex items-center justify-center p-4">
        <GlobalAnimStyles />
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full space-y-4">
          <AnimatedCheck size={80} />
          <h2 className="text-3xl font-black text-gray-900 fade-up" style={{ animationDelay: '100ms' }}>{lastSaved.total.toFixed(2)} ฿</h2>
          <div className="text-gray-500 text-sm space-y-1 fade-up" style={{ animationDelay: '200ms' }}>
            <p className="font-bold text-gray-800">Bill No: {lastSaved.billNo}</p>
            <p>{lastSaved.date} | {lastSaved.time}</p>
            <p>Payment: <span className="uppercase font-bold text-blue-600">{lastSaved.payment}</span></p>
          </div>
          <div className="py-3 border-t border-b border-dashed text-xs text-left space-y-1 fade-up" style={{ animationDelay: '300ms' }}>
             <div className="flex justify-between"><span>Subtotal:</span><span>{lastSaved.subtotal.toFixed(2)}</span></div>
             <div className="flex justify-between text-red-500"><span>Discount:</span><span>-{lastSaved.linemanDiscount.toFixed(2)}</span></div>
             <div className="flex justify-between text-orange-600"><span>Freebies:</span><span>{lastSaved.freebiesQty} pcs</span></div>
          </div>
          <button onClick={() => setStep('cart')} className="w-full py-3 bg-[#ac0000] text-white rounded-xl font-bold hover:opacity-90 fade-up" style={{ animationDelay: '400ms' }}>
            Done / New Bill
          </button>
        </div>
      </main>
    );
  }

  /* ========== Step Confirm ========== */
  if (step === 'confirm') {
    return (
      <main className="min-h-screen bg-[#fffff0] p-4">
        <GlobalAnimStyles />
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep('cart')} className="p-2 bg-white rounded-full border shadow-sm"><Minus /></button>
            <h1 className="text-3xl font-black">Confirm Order</h1>
          </div>
          
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <div className="flex justify-between text-2xl font-black border-b pb-4">
              <span>Grand Total</span>
              <span className="text-[#ac0000]">{grandTotal.toFixed(2)} ฿</span>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest">Items</h3>
              {cart.map(i => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span>{i.name} x{i.quantity}</span>
                  <span className="font-mono">{(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
              {freebies.map(f => (
                <div key={f.id} className="flex justify-between text-sm text-orange-600 italic">
                  <span>{f.name} x{f.qty} (Free)</span>
                  <span className="font-mono">0.00</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t space-y-2">
               <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest">Payment Method</h3>
               <div className="grid grid-cols-3 gap-2">
                  {['cash', 'promptpay', 'lineman'].map((m: any) => (
                    <button key={m} onClick={() => setPayment(m)} className={`py-3 rounded-xl border-2 font-bold uppercase text-xs transition-all ${payment === m ? 'bg-[#ac0000] border-[#ac0000] text-white shadow-md' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                      {m}
                    </button>
                  ))}
               </div>
            </div>

            <button 
              onClick={saveBill} 
              disabled={isSubmitting || !payment} 
              className="w-full py-4 bg-[#ac0000] text-white rounded-2xl font-black text-xl shadow-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Processing...' : 'PLACE ORDER'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ========== Step Cart (Main POS) ========== */
  return (
    <main className="min-h-screen bg-[#fffff0] pb-40">
      <GlobalAnimStyles />
      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex justify-between items-end">
          <Link href="/" className="group">
            <h1 className="text-3xl font-black tracking-tighter group-hover:text-[#ac0000] transition-colors flex items-center gap-2">
              <HomeIcon size={24}/> COCO BAKEHOUSE
            </h1>
          </Link>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Location</p>
            <p className="font-black text-sm">{location || 'NOT SELECTED'}</p>
          </div>
        </div>

        <div className="max-w-sm"><LocationPicker value={location} onChange={(loc) => setLocation(loc as LocationId)} /></div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map(c => (
            <button
              key={c.name}
              onClick={() => setActiveCat(c.name)}
              className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest border-2 transition-all whitespace-nowrap
                ${activeCat === c.name ? 'bg-black border-black text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-black hover:text-black'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {loadingProducts ? (
            Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />)
          ) : (
            displayProducts.map(p => {
              const inCart = !!addedMap[p.id];
              const inFree = !!addedFreeMap[p.id];
              return (
                <div key={p.id} className="bg-white border-2 border-gray-50 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-black text-gray-800 leading-tight">{p.name}</h3>
                    <p className="text-xs font-bold text-orange-500 mt-1">{p.price} ฿</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addToCart(p)} className={`py-2 rounded-xl font-bold text-[10px] uppercase tracking-tighter transition-all ${inCart ? 'bg-green-500 text-white animate-pop' : 'bg-[#ac0000] text-white hover:opacity-90'}`}>
                      {inCart ? 'Added' : 'Add'}
                    </button>
                    <button onClick={() => addFreebie(p)} className={`py-2 rounded-xl font-bold text-[10px] uppercase tracking-tighter transition-all border ${inFree ? 'bg-orange-100 border-orange-500 text-orange-700 animate-pop' : 'bg-white border-gray-100 text-gray-400'}`}>
                      Free
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Cart Bar */}
      {(cart.length > 0 || freebies.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className={`bg-white border-t-4 border-black shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all ${cartOpen ? 'h-[70vh]' : 'h-20'}`}>
            <div className="max-w-6xl mx-auto h-full flex flex-col">
              {/* Summary Bar */}
              <div className="h-20 px-6 flex items-center justify-between shrink-0">
                <button onClick={() => setCartOpen(!cartOpen)} className="flex items-center gap-2 font-black text-sm uppercase">
                  {cartOpen ? <ChevronDown /> : <ChevronUp />}
                  Cart ({totalQty + freebiesQty})
                </button>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total</p>
                    <p className="font-black text-xl text-[#ac0000]">{subtotal.toFixed(2)} ฿</p>
                  </div>
                  <button onClick={() => setStep('confirm')} className="px-8 py-3 bg-black text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-all">
                    Checkout
                  </button>
                </div>
              </div>

              {/* Drawer List */}
              {cartOpen && (
                <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-6">
                  {cart.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paid Items</h4>
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                          <span className="font-bold text-sm">{item.name}</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => changeQty(item.id, item.quantity - 1)} className="p-1 bg-white rounded-md border shadow-sm"><Minus size={14}/></button>
                            <span className="font-black w-4 text-center">{item.quantity}</span>
                            <button onClick={() => changeQty(item.id, item.quantity + 1)} className="p-1 bg-white rounded-md border shadow-sm"><Plus size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {freebies.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Freebies</h4>
                      {freebies.map(f => (
                        <div key={f.id} className="flex items-center justify-between bg-orange-50 p-3 rounded-xl border border-orange-100">
                          <span className="font-bold text-sm text-orange-800">{f.name}</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => changeFreeQty(f.id, f.qty - 1)} className="p-1 bg-white rounded-md border border-orange-200 text-orange-500"><Minus size={14}/></button>
                            <span className="font-black w-4 text-center text-orange-800">{f.qty}</span>
                            <button onClick={() => changeFreeQty(f.id, f.qty + 1)} className="p-1 bg-white rounded-md border border-orange-200 text-orange-500"><Plus size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-4 border-t">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Discount Code / Amount (฿)</label>
                    <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-black" placeholder="0.00" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
