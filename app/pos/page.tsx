// app/pos/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products';

// Lucide React Icons
import { ShoppingCart, Trash2, Plus, Minus, Home, CreditCard, Smartphone, Truck, CheckCircle } from "lucide-react";

export const dynamic = 'force-dynamic';

type Product = { id: number; name: string; price: number };
type CartItem = Product & { quantity: number };
type Step = 'cart' | 'summary' | 'confirm' | 'success';

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

  // Step flow
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
  const grandTotal = useMemo(() => {
    if (payment === 'lineman') {
      return totalAfterDiscount * (1 + linemanMarkupRate);
    }
    return totalAfterDiscount;
  }, [subtotal, discount, payment, linemanMarkupRate]);

  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  // Success
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
    setSubmitting(true);
    try {
      const date = toDateString(new Date());
      const time = toTimeString(new Date());
      const payload = {
        location,
        date,
        time,
        items: cart,
        freebies: [], // ยังไม่ได้ใช้ freebies
        subtotal,
        discount,
        linemanMarkup: payment === 'lineman' ? totalAfterDiscount * linemanMarkupRate : 0,
        total: grandTotal,
        payment,
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'บันทึกไม่สำเร็จ');

      setLastSaved({
        billNo: data?.saved?.billNo || 'N/A',
        date,
        time,
        payment,
        total: data?.saved?.total ?? grandTotal,
        subtotal: data?.saved?.subtotal ?? subtotal,
        discount: data?.saved?.discount ?? discount,
        linemanMarkup: data?.saved?.linemanMarkup ?? 0,
      });
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

  // ---------- UI Flow ----------
  if (step === 'success' && lastSaved) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fffff0]">
        <div className="bg-white p-6 rounded-xl shadow-md text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
          <h2 className="text-xl font-bold">บันทึกสำเร็จ</h2>
          <p>เลขที่บิล: {lastSaved.billNo}</p>
          <p>{lastSaved.date} {lastSaved.time}</p>
          <p>วิธีชำระ: {lastSaved.payment}</p>
          <p>Subtotal: {lastSaved.subtotal} บาท</p>
          <p>Discount: -{lastSaved.discount} บาท</p>
          {lastSaved.linemanMarkup > 0 && (
            <p>Lineman Markup: +{lastSaved.linemanMarkup} บาท</p>
          )}
          <p className="font-semibold text-lg">รวม {lastSaved.total.toFixed(2)} บาท</p>
          <button
            onClick={() => setStep('cart')}
            className="mt-4 px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90"
          >
            ทำรายการใหม่
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#fffff0]">
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

      <LocationPicker value={location} onChange={(loc) => setLocation(loc as LocationId)} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-32 mt-4">
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

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
          <div className="max-w-5xl mx-auto p-4 space-y-3">
            <div className="overflow-auto max-h-40">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b py-2">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.price} บาท</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.id, item.quantity - 1)}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => changeQty(item.id, item.quantity + 1)}>
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm text-gray-600">ส่วนลด (บาท)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="w-32 rounded border px-3 py-2"
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

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{subtotal} บาท</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{discount} บาท</span>
              </div>
              {payment === 'lineman' && (
                <div className="flex justify-between">
                  <span>Lineman Mark-up ({Math.round(linemanMarkupRate * 100)}%)</span>
                  <span>+{Math.round(totalAfterDiscount * linemanMarkupRate)} บาท</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg">
                <span>Grand Total</span>
                <span>{grandTotal.toFixed(2)} บาท</span>
              </div>
            </div>

            <button
              disabled={!payment || isSubmitting}
              onClick={saveBill}
              className="w-full mt-3 py-2 bg-[#ac0000] text-[#fffff0] rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {isSubmitting ? 'Saving…' : 'ยืนยันการขาย'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
