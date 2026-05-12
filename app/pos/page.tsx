'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import Link from 'next/link';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products';
import {
  ShoppingCart, Trash2, Plus, Minus, Home as HomeIcon,
  CreditCard, Smartphone, Truck, Gift
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
      @keyframes pop-added { 0%{transform:scale(1)} 30%{transform:scale(1.05)} 100%{transform:scale(1)} }
      .animate-pop { animation: pop-added 300ms ease; }
      @keyframes fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .fade-up { animation: fade-up .5s ease forwards; opacity: 0; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
    `}</style>
  );
}

function AnimatedCheck({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="mx-auto">
      <circle cx="40" cy="40" r="34" fill="none" stroke="#16a34a" strokeWidth="6" />
      <path d="M26 41 L36 50 L54 30" fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function POSPage() {
  const [location, setLocation] = useState<LocationId | null>(null);
  const [step, setStep] = useState<Step>('cart');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [freebies, setFreebies] = useState<FreebieItem[]>([]);
const [payment, setPayment] = useState<'cash' | 'promptpay' | 'lineman' | 'credit' | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [activeCat, setActiveCat] = useState<string>('All');
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<any>(null);

  useEffect(() => {
    const saved = (localStorage.getItem('pos_location') as LocationId | null);
    if (saved) setLocation(saved);
  }, []);

  useEffect(() => {
    if (location) localStorage.setItem('pos_location', location);
  }, [location]);

  async function reloadProducts() {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = await res.json();
      setProducts(data?.products || FALLBACK_PRODUCTS);
    } catch { setProducts(FALLBACK_PRODUCTS); } finally { setLoadingProducts(false); }
  }
  useEffect(() => { reloadProducts(); }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category?.trim() || 'General'));
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  const displayProducts = useMemo(() => {
    if (activeCat === 'All') return products;
    return products.filter(p => (p.category || 'General') === activeCat);
  }, [activeCat, products]);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const addFreebie = (p: Product) => {
    setFreebies(prev => {
      const idx = prev.findIndex(f => f.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: p.id, name: p.name, qty: 1, price: p.price }];
    });
  };

  const changeQty = (id: number, q: number) => {
    setCart(prev => q <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: q } : i));
  };

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const grandTotal = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  async function saveBill() {
    if (!location || !payment) return alert("Select Location & Payment");
    setSubmitting(true);
    try {
      const payload = {
        location, payment, date: toDateString(new Date()), time: toTimeString(new Date()),
        items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        freebies: freebies.map(f => ({ name: f.name, qty: f.qty, price: f.price || 0 })),
        subtotal, total: grandTotal, linemanDiscount: discount
      };
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setLastSaved({ ...payload, billNo: data.saved?.billNo });
      setStep('success');
      setCart([]); setFreebies([]); setPayment(null); setDiscount(0);
    } catch (e: any) { alert("Save failed"); } finally { setSubmitting(false); }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#fffff0] flex items-center justify-center p-4">
        <GlobalAnimStyles />
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full space-y-4 border-4 border-black">
          <AnimatedCheck size={60} />
          <h2 className="text-4xl font-black">{lastSaved?.total.toFixed(2)} ฿</h2>
          <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Bill No: {lastSaved?.billNo}</p>
          <button onClick={() => setStep('cart')} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all">Next Customer</button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fffff0] pb-20 lg:pb-10">
      <GlobalAnimStyles />
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/"><h1 className="text-3xl font-black tracking-tighter italic">COCO BAKEHOUSE</h1></Link>
          <div className="text-right"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</p><p className="font-black text-sm">{location || 'NOT SET'}</p></div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Menu Section */}
          <div className="lg:col-span-8 space-y-6">
            <div className="max-w-xs"><LocationPicker value={location} onChange={(loc) => setLocation(loc as LocationId)} /></div>
            
            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {categories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCat(cat)}
                  className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest border-2 transition-all whitespace-nowrap
                    ${activeCat === cat ? 'bg-black border-black text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:text-black'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {loadingProducts ? (
                <p>Loading items...</p>
              ) : displayProducts.map(p => (
                <div key={p.id} className="bg-white border-2 border-gray-50 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-black text-gray-800 leading-tight">{p.name}</h3>
                    <p className="text-xs font-bold text-orange-500 mt-1">{p.price.toFixed(2)} ฿</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addToCart(p)} className="py-2 bg-[#ac0000] text-white rounded-xl font-bold text-[10px] uppercase tracking-tighter hover:opacity-90 active:scale-95 transition-all">Add</button>
                    <button onClick={() => addFreebie(p)} className="py-2 border border-gray-200 text-gray-400 rounded-xl font-bold text-[10px] uppercase tracking-tighter hover:bg-gray-50 active:scale-95 transition-all">Free</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Cart Section (Fixed on Desktop, flows below on Mobile) */}
          <div className="lg:col-span-4 lg:sticky lg:top-10">
            <div className="bg-white border-4 border-black rounded-[2rem] p-6 shadow-2xl flex flex-col min-h-[500px]">
              <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4 mb-4">
                <ShoppingCart className="text-[#ac0000]" />
                <h2 className="text-xl font-black uppercase tracking-tight">Current Order</h2>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 max-h-[400px] no-scrollbar">
                {cart.length === 0 && freebies.length === 0 && (
                  <div className="text-center py-20 text-gray-300 font-bold italic uppercase text-sm">Cart is empty</div>
                )}
                
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                    <div className="flex-1">
                      <p className="font-black text-xs uppercase">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{(item.price * item.quantity).toFixed(2)} ฿</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => changeQty(item.id, item.quantity - 1)} className="p-1 bg-white rounded-lg border shadow-sm"><Minus size={14}/></button>
                      <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                      <button onClick={() => changeQty(item.id, item.quantity + 1)} className="p-1 bg-white rounded-lg border shadow-sm"><Plus size={14}/></button>
                    </div>
                  </div>
                ))}

                {freebies.map(f => (
                  <div key={f.id} className="flex justify-between items-center bg-orange-50 border border-orange-100 p-3 rounded-xl">
                    <div className="flex-1">
                      <p className="font-black text-xs uppercase text-orange-800">{f.name}</p>
                      <p className="text-[10px] text-orange-400">GIFTED</p>
                    </div>
                    <span className="font-black text-sm text-orange-800">x{f.qty}</span>
                  </div>
                ))}
              </div>

              {/* Footer / Summary */}
              <div className="space-y-4 pt-4 border-t-2 border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount (฿)</span>
                  <input 
                    type="number" value={discount} 
                    onChange={e => setDiscount(Number(e.target.value))} 
                    className="w-20 p-1 bg-gray-50 rounded border-b-2 border-black font-black text-right outline-none"
                  />
                </div>
                
                <div className="flex justify-between items-end pb-2">
                  <span className="font-black text-xs uppercase text-gray-400">Total Amount</span>
                  <span className="text-3xl font-black text-[#ac0000]">{grandTotal.toFixed(2)} ฿</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
  {['cash', 'promptpay', 'lineman', 'credit'].map(m => (
    <button 
      key={m} 
      onClick={() => setPayment(m as any)}
      className={`py-3 rounded-xl border-2 font-black uppercase text-[9px] transition-all
        ${payment === m 
          ? 'bg-black border-black text-white shadow-lg' 
          : 'bg-gray-50 border-transparent text-gray-300'}`}
    >
      {m === 'credit' ? 'Card' : m}
    </button>
  ))}
</div>

                <button 
                  onClick={saveBill}
                  disabled={isSubmitting || !location || (cart.length === 0 && freebies.length === 0) || !payment}
                  className="w-full py-4 bg-[#ac0000] text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl hover:opacity-90 disabled:opacity-20 active:scale-95 transition-all"
                >
                  {isSubmitting ? 'Processing...' : 'Complete Order'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
