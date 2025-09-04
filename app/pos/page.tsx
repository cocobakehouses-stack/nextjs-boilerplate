// app/pos/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products';

import {
  ShoppingCart, Trash2, Plus, Minus, Home,
  CreditCard, Smartphone, Truck, CheckCircle, ChevronDown, ChevronUp
} from "lucide-react";

export const dynamic = 'force-dynamic';

type Product = { id: number; name: string; price: number };
type CartItem = Product & { quantity: number };
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
  const [payment, setPayment] = useState<'cash' | 'promptpay' | 'lineman' | null>(null);

  // Discount + Markup
  const [discount, setDiscount] = useState<number>(0);
  const [linemanMarkupRate] = useState<number>(0.15); // 15%

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  async function reloadProducts() {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: Product[] = data?.products || [];
      if (list.length > 0) setProducts(list);
      else setProducts(FALLBACK_PRODUCTS);
    } catch {
      setProducts(FALLBACK_PRODUCTS);
    } finally {
      setLoadingProducts(false);
    }
  }
  useEffect(() => { reloadProducts(); }, []);

  // Cart ops
  const addToCart = (p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { ...p, quantity: 1 }];
    });
  };
  const changeQty = (id: number, q: number) => {
    setCart((prev) => {
      if (q <= 0) return prev.filter((i) => i.id !== id);
      return prev.map((i) => (i.id === id ? { ...i, quantity: q } : i));
    });
  };
  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  // Totals
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const totalAfterDiscount = Math.max(0, subtotal - discount);
  const linemanMarkupValue = useMemo(
    () => (payment === 'lineman' ? totalAfterDiscount * linemanMarkupRate : 0),
    [payment, totalAfterDiscount, linemanMarkupRate]
  );
  const grandTotal = useMemo(() => Number((totalAfterDiscount + linemanMarkupValue).toFixed(2)), [totalAfterDiscount, linemanMarkupValue]);
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  // Submit / Success
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<{
    billNo: string; date: string; time: string; payment: string; total: number;
    subtotal: number; discount: number; linemanMarkup: number;
  } | null>(null);

  async function saveBill() {
    if (!location || !payment) {
      alert("กรุณาเลือกสถานที่และวิธีชำระเงิน");
      return;
    }
    if (cart.length === 0) {
      alert("กรุณาเพิ่มสินค้า");
      return;
    }

    setSubmitting(true);
    try {
      const date = toDateString(new Date());
      const time = toTimeString(new Date());

      const payload = {
        location,
        date,
        time,
        payment, // 'cash' | 'promptpay' | 'lineman'
        items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        freebies: [],
        subtotal: Number(subtotal.toFixed(2)),
        freebiesAmount: 0,
        linemanMarkup: Number(linemanMarkupValue.toFixed(2)),
        linemanDiscount: Number(discount.toFixed(2)), // ใช้เป็นส่วนลดรวม
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
        discount: Number(saved.linemanDiscount ?? payload.linemanDiscount),
        linemanMarkup: Number(saved.linemanMarkup ?? payload.linemanMarkup),
      });

      // reset
      setCart([]);
      setPayment(null);
      setDiscount(0);
      setStep('success');
    } catch (e: any) {
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- SUCCESS ----------
  if (step === 'success' && lastSaved) {
    return (
      <main className="min-h-screen bg-[#fffff0]">
        <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <HeaderMenu />
          </div>
        </div>

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
              {lastSaved.linemanMarkup > 0 && (
                <p>Lineman Markup: +{lastSaved.linemanMarkup.toFixed(2)} บาท</p>
              )}
            </div>
            <button
              onClick={() => setStep('cart')}
              className="mt-4 px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90"
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
    const [cartOpen, setCartOpen] = useState<boolean>(true); // 👈 toggle ซ่อน/แสดงตะกร้า

    return (
      <main className="min-h-screen bg-[#fffff0]">
        {/* Sticky global header */}
        <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <HeaderMenu />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 pt-6 pb-40">
          {/* Page header */}
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-gray-600" />
              <h1 className="text-3xl font-bold">Coco Bakehouse POS</h1>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">
                Location: <b>{location ?? '— เลือกก่อนใช้งาน —'}</b>
              </span>
            </div>
          </div>

          {/* Location */}
          <LocationPicker value={location} onChange={(loc) => setLocation(loc as LocationId)} />

          {/* Products */}
          <div className="mt-4">
            {loadingProducts ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white border rounded-xl p-3 animate-pulse h-28" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-gray-600 italic border rounded-xl bg-white p-6 text-center">
                ไม่มีสินค้าให้เลือก
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((p) => (
                  <div key={p.id} className="bg-white border rounded-xl p-3 flex flex-col">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-500">{p.price} บาท</div>
                    <button
                      onClick={() => addToCart(p)}
                      className="mt-auto px-3 py-1 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 text-sm"
                    >
                      เพิ่ม
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart drawer */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
            {/* Bar */}
            <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
              <button
                onClick={() => setCartOpen((s) => !s)}
                className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50 text-sm flex items-center gap-1"
                aria-expanded={cartOpen}
              >
                {cartOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                {cartOpen ? 'ซ่อนตะกร้า' : 'แสดงตะกร้า'}
              </button>

              <div className="ml-auto flex items-center gap-4 text-sm">
                <div>ชิ้นทั้งหมด: <b>{totalQty}</b></div>
                <div>รวม: <b>{subtotal.toFixed(2)}</b> บาท</div>
                <button
                  onClick={() => setStep('confirm')}
                  className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
                  disabled={!location || cart.length === 0}
                >
                  ดำเนินการต่อ
                </button>
              </div>
            </div>

            {/* Collapsible content */}
            {cartOpen && (
              <div className="max-w-6xl mx-auto px-4 pb-3">
                {/* รายการในตะกร้า: จำกัดความสูง + scroll ในตัวเอง ไม่ดันหน้า */}
                <div className="overflow-auto max-h-44 border rounded-lg">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b last:border-b-0 px-3 py-2">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.price} บาท</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(item.id, item.quantity - 1)} aria-label="decrease">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => changeQty(item.id, item.quantity + 1)} aria-label="increase">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeFromCart(item.id)} aria-label="remove">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

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
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 px-3 py-2 rounded-lg border ${payment === 'cash' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                      onClick={() => setPayment('cash')}
                    >
                      <CreditCard className="inline w-4 h-4 mr-1" /> เงินสด
                    </button>
                    <button
                      className={`flex-1 px-3 py-2 rounded-lg border ${payment === 'promptpay' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                      onClick={() => setPayment('promptpay')}
                    >
                      <Smartphone className="inline w-4 h-4 mr-1" /> PromptPay
                    </button>
                    <button
                      className={`flex-1 px-3 py-2 rounded-lg border ${payment === 'lineman' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                      onClick={() => setPayment('lineman')}
                    >
                      <Truck className="inline w-4 h-4 mr-1" /> Lineman
                    </button>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{subtotal.toFixed(2)} บาท</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>-{discount.toFixed(2)} บาท</span>
                    </div>
                    {payment === 'lineman' && (
                      <div className="flex justify-between">
                        <span>Lineman Mark-up ({Math.round(linemanMarkupRate * 100)}%)</span>
                        <span>+{linemanMarkupValue.toFixed(2)} บาท</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Grand Total</span>
                      <span>{grandTotal.toFixed(2)} บาท</span>
                    </div>
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
        <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <HeaderMenu />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* ยอดรวมเป็นหัวเรื่องใหญ่บนสุด */}
          <h1 className="text-3xl font-extrabold mb-2">รวม {grandTotal.toFixed(2)} บาท</h1>
          <div className="text-sm text-gray-600 mb-6">
            สาขา: <b>{location ?? '-'}</b> • จำนวนชิ้น: <b>{totalQty}</b> • Subtotal: <b>{subtotal.toFixed(2)}</b> • Discount: <b>-{discount.toFixed(2)}</b>
            {payment === 'lineman' ? <> • Mark-up: <b>+{linemanMarkupValue.toFixed(2)}</b></> : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* รายการสินค้า */}
            <div className="lg:col-span-2 bg-white rounded-xl border p-4">
              <h2 className="font-semibold mb-3">รายการสินค้า</h2>
              {cart.length === 0 ? (
                <div className="text-gray-600">ไม่มีสินค้า</div>
              ) : (
                <div className="divide-y">
                  {cart.map(i => (
                    <div key={i.id} className="py-2 flex justify-between text-sm">
                      <div>{i.name} × {i.quantity}</div>
                      <div>{(i.price * i.quantity).toFixed(2)} บาท</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* วิธีชำระ & action */}
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold mb-3">วิธีชำระเงิน</h2>
              <div className="flex gap-2 mb-4">
                <button
                  className={`flex-1 px-3 py-2 rounded-lg border ${payment === 'cash' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                  onClick={() => setPayment('cash')}
                >
                  <CreditCard className="inline w-4 h-4 mr-1" /> เงินสด
                </button>
                <button
                  className={`flex-1 px-3 py-2 rounded-lg border ${payment === 'promptpay' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                  onClick={() => setPayment('promptpay')}
                >
                  <Smartphone className="inline w-4 h-4 mr-1" /> PromptPay
                </button>
                <button
                  className={`flex-1 px-3 py-2 rounded-lg border ${payment === 'lineman' ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-gray-50'}`}
                  onClick={() => setPayment('lineman')}
                >
                  <Truck className="inline w-4 h-4 mr-1" /> Lineman
                </button>
              </div>

              <div className="text-sm space-y-1 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{subtotal.toFixed(2)} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{discount.toFixed(2)} บาท</span>
                </div>
                {payment === 'lineman' && (
                  <div className="flex justify-between">
                    <span>Lineman Mark-up ({Math.round(linemanMarkupRate * 100)}%)</span>
                    <span>+{linemanMarkupValue.toFixed(2)} บาท</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg">
                  <span>Grand Total</span>
                  <span>{grandTotal.toFixed(2)} บาท</span>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('cart')}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                >
                  กลับไปแก้
                </button>
                <button
                  onClick={saveBill}
                  className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
                  disabled={!payment || cart.length === 0 || isSubmitting}
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

  // fallback (shouldn't happen)
  return null;
}
