// app/pos/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import Link from 'next/link';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products';
import {
  ShoppingCart, Trash2, Plus, Minus, Home as HomeIcon,
  CreditCard, Smartphone, Truck, CheckCircle, ChevronDown, ChevronUp, Gift
} from "lucide-react";

export const dynamic = 'force-dynamic';

type Product = { id: number; name: string; price: number; category?: string };
type CartItem = Product & { quantity: number };
type FreebieItem = { id: number; name: string; qty: number; price?: number };
type Step = 'cart' | 'confirm' | 'success';

const TZ = 'Asia/Bangkok';
function toDateString(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
function toTimeString(d: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d).replace(/\./g, ':');
}

// ---- global styles for animations ----
function GlobalAnimStyles() {
  return (
    <style jsx global>{`
      @keyframes cart-bump { 0%{transform:scale(1)} 20%{transform:scale(1.06)} 60%{transform:scale(0.98)} 100%{transform:scale(1)} }
      .animate-bump { animation: cart-bump 320ms ease; }
      @keyframes pop-added { 0%{transform:scale(1)} 30%{transform:scale(1.05)} 100%{transform:scale(1)} }
      .animate-pop { animation: pop-added 300ms ease; }
      /* ✅ success: วาดขอบวงกลม + ขีดถูก + เด้ง */
      @keyframes dash { to { stroke-dashoffset: 0; } }
      @keyframes scale-pop { 0%{ transform: scale(.8); opacity:0 } 60%{ transform: scale(1.08); opacity:1 } 100%{ transform: scale(1) } }

      /* ✅ success: เฟดทีละบรรทัด (เลื่อนขึ้นนิดหน่อย) */
      @keyframes fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .fade-up { animation: fade-up .5s ease forwards; opacity: 0; }
    `}</style>

  );
}

export default function POSPage() {
  // Location
  const [location, setLocation] = useState<LocationId | null>(null);
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

  // Steps
  const [step, setStep] = useState<Step>('cart');

  // Core states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [freebies, setFreebies] = useState<FreebieItem[]>([]); // ✅ กลับมาแล้ว
  const [payment, setPayment] = useState<'cash' | 'promptpay' | 'lineman' | null>(null);

  // Discount
  const [discount, setDiscount] = useState<number>(0);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

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

  // ไม่มี x1.48 แล้ว
  const effectiveUnitPrice = (p: Product) => p.price;

  // Categories
  const categories = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const cat = p.category?.trim() || 'All';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    const keys = Array.from(map.keys());
    keys.sort((a, b) => {
      if (a === 'All') return 1;
      if (b === 'All') return -1;
      return a.localeCompare(b, 'en');
    });
    return keys.map(k => ({ name: k, items: map.get(k)! }));
  }, [products]);
  const [activeCat, setActiveCat] = useState<string>('All');

  // ---- micro-feedback states ----
  const [addedMap, setAddedMap] = useState<Record<number, boolean>>({});
  const [addedFreeMap, setAddedFreeMap] = useState<Record<number, boolean>>({});
  const [cartBump, setCartBump] = useState<number>(0);

  // Cart ops
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

  // Freebies ops
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
    setCart((prev) => {
      if (q <= 0) return prev.filter((i) => i.id !== id);
      return prev.map((i) => (i.id === id ? { ...i, quantity: q } : i));
    });
  };
  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id));

  const changeFreeQty = (id: number, q: number) => {
    setFreebies(prev => {
      if (q <= 0) return prev.filter(f => f.id !== id);
      return prev.map(f => (f.id === id ? { ...f, qty: q } : f));
    });
  };
  const removeFree = (id: number) => setFreebies(prev => prev.filter(f => f.id !== id));

  // Totals
  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + effectiveUnitPrice(i) * i.quantity, 0),
    [cart, payment]
  );
  // มูลค่าของฟรี เพื่อส่งไปลงรายงาน (ไม่คิดเงินลูกค้า แต่โชว์ใน History)
  const freebiesAmount = useMemo(
    () => freebies.reduce((s, f) => s + (f.price || 0) * f.qty, 0),
    [freebies]
  );
  const grandTotal = useMemo(
    () => Number(Math.max(0, subtotal - discount).toFixed(2)),
    [subtotal, discount]
  );
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const freebiesQty = useMemo(() => freebies.reduce((s, f) => s + f.qty, 0), [freebies]);

  // Submit / Success
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<{
    billNo: string; date: string; time: string; payment: string; total: number;
    subtotal: number; discount: number; freebiesQty: number; freebiesAmount: number;
  } | null>(null);

  async function saveBill() {
    if (!location || !payment) {
      alert("กรุณาเลือกสถานที่และวิธีชำระเงิน");
      return;
    }
    if (cart.length === 0 && freebies.length === 0) {
      alert("กรุณาเพิ่มสินค้า (หรือของฟรี)");
      return;
    }

    setSubmitting(true);
    try {
      const date = toDateString(new Date());
      const time = toTimeString(new Date());

      const items = cart.map(i => ({
        name: i.name,
        qty: i.quantity,
        price: effectiveUnitPrice(i),
      }));

      // ส่ง freebies แยกเป็นรายการ พร้อมมูลค่าต่อชิ้น (price) เพื่อ backend ลง Freebies & FreebiesAmount
      const payload = {
        location,
        date,
        time,
        payment, // 'cash' | 'promptpay' | 'lineman'
        items,
        freebies: freebies.map(f => ({ name: f.name, qty: f.qty, price: f.price || 0 })),
        subtotal: Number(subtotal.toFixed(2)),
        freebiesAmount: Number(freebiesAmount.toFixed(2)),
        linemanMarkup: 0,
        linemanDiscount: 0,
        total: Number(grandTotal.toFixed(2)),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'บันทึกไม่สำเร็จ');

      const saved = data?.saved ?? {};
      setLastSaved({
        billNo: saved.billNo ?? 'N/A',
        date: saved.date ?? date,
        time: saved.time ?? time,
        payment,
        total: Number(saved.total ?? payload.total),
        subtotal: Number(saved.subtotal ?? payload.subtotal),
        discount: Number(saved.linemanDiscount ?? 0),
        freebiesQty,
        freebiesAmount,
      });

      // reset
      setCart([]);
      setFreebies([]);
      setPayment(null);
      setDiscount(0);
      setStep('success');
    } catch (e: any) {
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  // ซ่อน/แสดงตะกร้า — default เป็น "ย่อ"
  const [cartOpen, setCartOpen] = useState<boolean>(false);

  // ---------- SUCCESS ----------
  if (step === 'success' && lastSaved) {
    return (
      <main className="min-h-screen bg-[#fffff0]">
        <GlobalAnimStyles />
        <div className="max-w-6xl mx-auto px-4 py-10 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-md text-center space-y-3 w-full max-w-md">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <h2 className="text-2xl font-extrabold">รวม {lastSaved.total.toFixed(2)} บาท</h2>
            <p className="text-sm text-gray-600">เลขที่บิล: {lastSaved.billNo}</p>
            <p className="text-sm text-gray-600">{lastSaved.date} {lastSaved.time}</p>
            <p className="text-sm text-gray-600">วิธีชำระ: {lastSaved.payment}</p>
            <div className="text-sm space-y-1 mt-2">
              <p>Subtotal: {lastSaved.subtotal.toFixed(2)} บาท</p>
              <p>Discount: -{lastSaved.discount.toFixed(2)} บาท</p>
              <p>Freebies: {lastSaved.freebiesQty} ชิ้น (มูลค่า {lastSaved.freebiesAmount.toFixed(2)} บาท)</p>
            </div>
            <button
              onClick={() => setStep('cart')}
              className="mt-4 px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 w-full sm:w-auto"
            >
              ทำรายการใหม่
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- CART SCREEN ----------
  if (step === 'cart') {
    return (
      <main className="min-h-screen bg-[#fffff0]">
        <GlobalAnimStyles />
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-40">
          {/* Page header */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <HomeIcon className="w-5 h-5 text-gray-600 group-hover:text-black" />
              <span className="text-2xl sm:text-3xl font-bold hover:underline">Coco Bakehouse POS</span>
            </Link>
            <div className={`flex items-center gap-2 ${cartBump ? 'animate-bump' : ''}`} key={cartBump}>
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">
                Location: <b>{location ?? '— เลือกก่อนใช้งาน —'}</b>
              </span>
            </div>
          </div>

          {/* Location */}
          <div className="max-w-md">
            <LocationPicker value={location} onChange={(loc) => setLocation(loc as LocationId)} />
          </div>

          {/* Category tabs + Products */}
          <div className="mt-4">
            {/* Tabs */}
            <div className="flex gap-2 overflow-auto pb-2">
              {categories.map(c => (
                <button
                  key={c.name}
                  onClick={() => setActiveCat(c.name)}
                  className={`px-3 py-1 rounded-full border text-sm whitespace-nowrap ${activeCat === c.name ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-white hover:bg-gray-50'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Grid */}
            {loadingProducts ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white border rounded-xl p-3 animate-pulse h-28" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-gray-600 italic border rounded-xl bg-white p-6 text-center">
                ไม่มีสินค้าให้เลือก
              </div>
            ) : (
              categories
                .filter(c => c.name === activeCat)
                .map(c => (
                  <div key={c.name} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                    {c.items.map((p) => {
                      const isAdded = !!addedMap[p.id];
                      const isFreeAdded = !!addedFreeMap[p.id];
                      return (
                        <div key={p.id} className="bg-white border rounded-xl p-3 flex flex-col gap-2">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-sm text-gray-500">{p.price} บาท</div>
                          <div className="mt-auto grid grid-cols-2 gap-2">
                            <button
                              onClick={() => addToCart(p)}
                              className={`px-3 py-2 rounded-lg text-sm w-full
                                ${isAdded ? 'bg-green-600 text-white animate-pop' : 'bg-[#ac0000] text-[#fffff0] hover:opacity-90'}`}
                            >
                              {isAdded ? 'Added ✓' : 'เพิ่ม'}
                            </button>
                            <button
                              onClick={() => addFreebie(p)}
                              className={`px-3 py-2 rounded-lg text-sm w-full border
                                ${isFreeAdded ? 'bg-green-50 text-green-700 animate-pop border-green-600' : 'bg-white hover:bg-gray-50'}`}
                              title="เพิ่มเป็นของฟรี"
                            >
                              <Gift className="inline w-4 h-4 mr-1" />
                              ฟรี
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Cart drawer */}
        {(cart.length > 0 || freebies.length > 0) && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
            {/* Bar */}
            <div className={`max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 ${cartBump ? 'animate-bump' : ''}`} key={`bar-${cartBump}`}>
              <button
                onClick={() => setCartOpen((s) => !s)}
                className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50 text-sm flex items-center gap-1"
                aria-expanded={cartOpen}
              >
                {cartOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                {cartOpen ? 'ซ่อนตะกร้า' : 'แสดงตะกร้า'}
              </button>

              <div className="ml-auto flex items-center gap-4 text-sm">
                <div>ขาย: <b className="tabular-nums">{totalQty}</b></div>
                <div>ฟรี: <b className="tabular-nums">{freebiesQty}</b></div>
                <div>รวม: <b className="tabular-nums">{subtotal.toFixed(2)}</b> บาท</div>
                <button
                  onClick={() => setStep('confirm')}
                  className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
                  disabled={!location || (cart.length === 0 && freebies.length === 0)}
                >
                  ดำเนินการต่อ
                </button>
              </div>
            </div>

            {/* Collapsible content */}
            {cartOpen && (
              <div className="max-w-6xl mx-auto px-4 pb-3">
                {/* รายการในตะกร้า (ขาย) */}
                {cart.length > 0 && (
                  <>
                    <div className="text-sm font-semibold mt-2 mb-1">ขาย</div>
                    <div className="overflow-auto max-h-40 border rounded-lg">
                      {cart.map((item) => {
                        const unit = effectiveUnitPrice(item);
                        return (
                          <div key={item.id} className="flex items-center justify-between border-b last:border-b-0 px-3 py-2">
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-gray-500">{unit.toFixed(2)} บาท/ชิ้น</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => changeQty(item.id, item.quantity - 1)} aria-label="decrease">
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="tabular-nums">{item.quantity}</span>
                              <button onClick={() => changeQty(item.id, item.quantity + 1)} aria-label="increase">
                                <Plus className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeFromCart(item.id)} aria-label="remove">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* รายการของฟรี */}
                {freebies.length > 0 && (
                  <>
                    <div className="text-sm font-semibold mt-4 mb-1">ของฟรี</div>
                    <div className="overflow-auto max-h-40 border rounded-lg">
                      {freebies.map((f) => (
                        <div key={f.id} className="flex items-center justify-between border-b last:border-b-0 px-3 py-2">
                          <div>
                            <div className="font-medium">{f.name}</div>
                            <div className="text-xs text-gray-500">มูลค่า {((f.price||0) * f.qty).toFixed(2)} บาท (ไม่คิดเงิน)</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => changeFreeQty(f.id, f.qty - 1)} aria-label="decrease-free">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="tabular-nums">{f.qty}</span>
                            <button onClick={() => changeFreeQty(f.id, f.qty + 1)} aria-label="increase-free">
                              <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeFree(f.id)} aria-label="remove-free">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Discount + Payment + Totals */}
                <div className="grid sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-sm text-gray-600">ส่วนลด (บาท)</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      className="w-full sm:w-40 rounded border px-3 py-2"
                    />
                  </div>
                  <div className="flex gap-2 sm:flex-row flex-col">
                    <button
                      className={`sm:flex-1 w-full px-3 py-2 rounded-lg border ${payment === 'cash' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                      onClick={() => setPayment('cash')}
                    >
                      <CreditCard className="inline w-4 h-4 mr-1" /> เงินสด
                    </button>
                    <button
                      className={`sm:flex-1 w-full px-3 py-2 rounded-lg border ${payment === 'promptpay' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                      onClick={() => setPayment('promptpay')}
                    >
                      <Smartphone className="inline w-4 h-4 mr-1" /> PromptPay
                    </button>
                    <button
                      className={`sm:flex-1 w-full px-3 py-2 rounded-lg border ${payment === 'lineman' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                      onClick={() => setPayment('lineman')}
                    >
                      <Truck className="inline w-4 h-4 mr-1" /> Lineman
                    </button>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{subtotal.toFixed(2)} บาท</span></div>
                    <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">-{discount.toFixed(2)} บาท</span></div>
                    <div className="flex justify-between"><span>Freebies (มูลค่า)</span><span className="tabular-nums">{freebiesAmount.toFixed(2)} บาท</span></div>
                    <div className="flex justify-between font-semibold text-lg"><span>Grand Total</span><span className="tabular-nums">{grandTotal.toFixed(2)} บาท</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    );
  }

  // ---------- CONFIRM SCREEN ----------
  if (step === 'confirm') {
    return (
      <main className="min-h-screen bg-[#fffff0]">
        <GlobalAnimStyles />
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-2">รวม {grandTotal.toFixed(2)} บาท</h1>
          <div className="text-sm text-gray-600 mb-6">
            สาขา: <b>{location ?? '-'}</b> • ขาย: <b className="tabular-nums">{totalQty}</b> • ฟรี: <b className="tabular-nums">{freebiesQty}</b> • Subtotal: <b className="tabular-nums">{subtotal.toFixed(2)}</b> • Discount: <b className="tabular-nums">-{discount.toFixed(2)}</b> • Freebies มูลค่า: <b className="tabular-nums">{freebiesAmount.toFixed(2)}</b>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-white rounded-xl border p-4">
              <h2 className="font-semibold mb-3">รายการสินค้า</h2>
              {(cart.length === 0 && freebies.length === 0) ? (
                <div className="text-gray-600">ไม่มีสินค้า</div>
              ) : (
                <>
                  {/* paid items */}
                  {cart.length > 0 && (
                    <>
                      <div className="text-sm font-semibold mb-1">ขาย</div>
                      <div className="divide-y">
                        {cart.map(i => {
                          const unit = effectiveUnitPrice(i);
                          return (
                            <div key={i.id} className="py-2 flex justify-between text-sm">
                              <div>{i.name} × <span className="tabular-nums">{i.quantity}</span></div>
                              <div className="tabular-nums">{(unit * i.quantity).toFixed(2)} บาท</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* freebies */}
                  {freebies.length > 0 && (
                    <>
                      <div className="text-sm font-semibold mt-3 mb-1">ของฟรี</div>
                      <div className="divide-y">
                        {freebies.map(f => (
                          <div key={f.id} className="py-2 flex justify-between text-sm">
                            <div>{f.name} × <span className="tabular-nums">{f.qty}</span></div>
                            <div className="tabular-nums text-gray-500">มูลค่า {((f.price||0)*f.qty).toFixed(2)} บาท (ไม่คิดเงิน)</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold mb-3">วิธีชำระเงิน</h2>
              <div className="flex gap-2 mb-4 sm:flex-row flex-col">
                <button className={`sm:flex-1 w-full px-3 py-2 rounded-lg border ${payment === 'cash' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`} onClick={() => setPayment('cash')}>
                  <CreditCard className="inline w-4 h-4 mr-1" /> เงินสด
                </button>
                <button className={`sm:flex-1 w-full px-3 py-2 rounded-lg border ${payment === 'promptpay' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`} onClick={() => setPayment('promptpay')}>
                  <Smartphone className="inline w-4 h-4 mr-1" /> PromptPay
                </button>
                <button className={`sm:flex-1 w-full px-3 py-2 rounded-lg border ${payment === 'lineman' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`} onClick={() => setPayment('lineman')}>
                  <Truck className="inline w-4 h-4 mr-1" /> Lineman
                </button>
              </div>

              <div className="text-sm space-y-4 mb-8">
                <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{subtotal.toFixed(2)} บาท</span></div>
                <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">-{discount.toFixed(2)} บาท</span></div>
                <div className="flex justify-between"><span>Freebies (มูลค่า)</span><span className="tabular-nums">{freebiesAmount.toFixed(2)} บาท</span></div>
                <div className="flex justify-between font-semibold text-lg"><span>Grand Total</span><span className="tabular-nums">{grandTotal.toFixed(2)} บาท</span></div>
              </div>

              <div className="flex sm:justify-between gap-2 sm:flex-row flex-col">
                <button onClick={() => setStep('cart')} className="px-4 py-2 rounded-lg border hover:bg-gray-50 w-full sm:w-auto">กลับไปแก้</button>
                <button
                  onClick={saveBill}
                  className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40 w-full sm:w-auto"
                  disabled={!payment || (cart.length === 0 && freebies.length === 0) || isSubmitting}
                >
                  {isSubmitting ? 'Saving…' : 'ยืนยันการขาย'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // fallback
  return null;
}
