// app/pos/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products';

// 🆕 Lucide React Icons
import { ShoppingCart, Trash2, Plus, Minus, Home, CreditCard, Smartphone, Truck } from "lucide-react";

export const dynamic = 'force-dynamic';

// ---------- Types ----------
type Product = { id: number; name: string; price: number };
type CartItem = Product & { quantity: number };
type Line = { name: string; qty: number; price: number };
type Step = 'cart' | 'summary' | 'confirm' | 'success';

// ---------- Helpers ----------
const TZ = 'Asia/Bangkok';
function toDateString(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
function toTimeString(d: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d).replace(/\./g, ':');
}
function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
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
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [payment, setPayment] = useState<'cash' | 'promptpay' | 'lineman' | null>(null);

  // ---------- Products from API (with fallback) ----------
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

  // Freebies
  const [freebies, setFreebies] = useState<Line[]>([]);
  const [freebiePick, setFreebiePick] = useState<number>(FALLBACK_PRODUCTS[0]?.id ?? 0);
  useEffect(() => { if (products.length > 0) setFreebiePick(products[0].id); }, [products]);

  // Date/Time
  const [dateStr, setDateStr] = useState<string>(toDateString(new Date()));
  const [timeStr, setTimeStr] = useState<string>(toTimeString(new Date()));

  // For success screen
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<{
    billNo: string; date: string; time: string; payment: 'cash' | 'promptpay' | 'lineman'; total: number;
  } | null>(null);

  // ---------- Products: auto-sort + grouping ----------
  const allProducts = useMemo<Product[]>(() => {
    const merged = [...products];
    merged.sort((a, b) => b.price - a.price);
    return merged;
  }, [products]);

  const grouped = useMemo(() => {
    const premium: Product[] = [];
    const levain: Product[] = [];
    const soft: Product[] = [];
    for (const p of allProducts) {
      if (p.price > 135) premium.push(p);
      else if (p.price >= 125 && p.price <= 135) levain.push(p);
      else if (p.price <= 109) soft.push(p);
    }
    return { premium, levain, soft };
  }, [allProducts]);

  // ---------- Add new product (inline) ----------
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [busyAddProduct, setBusyAddProduct] = useState(false);

  // Add panel open state (persist)
  const [addPanelOpen, setAddPanelOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem('pos_add_panel_open');
      return raw === null ? true : raw === '1';
    } catch { return true; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('pos_add_panel_open', addPanelOpen ? '1' : '0'); } catch {}
  }, [addPanelOpen]);

  async function addNewProduct() {
    const name = newName.trim();
    const price = Number(newPrice);
    if (!name || !Number.isFinite(price) || price <= 0) {
      alert('กรอกชื่อและราคาที่ถูกต้อง');
      return;
    }
    try {
      setBusyAddProduct(true);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Add product failed');
      await reloadProducts();
      setNewName('');
      setNewPrice('');
      alert('เพิ่มเมนูสำเร็จ');
    } catch (e: any) {
      alert(e?.message || 'Add product failed');
    } finally {
      setBusyAddProduct(false);
    }
  }

  // ---------- Cart operations ----------
  const addToCart = (p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id && i.name === p.name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { ...p, quantity: 1 }];
    });
    setAdded((prev) => ({ ...prev, [p.id]: true }));
    setTimeout(() => setAdded((prev) => ({ ...prev, [p.id]: false })), 600);
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

  // ---------- Totals ----------
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  // ---------- UI ----------
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#fffff0]">
      {/* Header */}
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

      {/* Location Gate */}
      <LocationPicker value={location} onChange={(loc) => setLocation(loc as LocationId)} />

      {/* Cart footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
          <div className="max-w-5xl mx-auto flex justify-between items-center p-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <span>{totalQty} ชิ้น</span>
              <span className="font-semibold">{subtotal} บาท</span>
            </div>
            <button className="px-4 py-2 bg-[#ac0000] text-[#fffff0] rounded-lg hover:opacity-90">
              ดำเนินการต่อ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
