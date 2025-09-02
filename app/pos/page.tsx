// app/pos/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products';

// 🆕 Lucide React Icons
import { ShoppingCart, Trash2, Plus, Minus, Home } from "lucide-react";

export const dynamic = 'force-dynamic';

// ---------- Types ----------
type Product = { id: number; name: string; price: number };
type CartItem = Product & { quantity: number };

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

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [added, setAdded] = useState<Record<number, boolean>>({});

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

      {/* Product grid */}
      {location && (
        <div className="mt-6">
          {loadingProducts ? (
            <p className="text-gray-600">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="text-gray-600">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="border rounded-xl bg-white p-4 shadow-sm flex flex-col items-center"
                >
                  <h3 className="font-semibold text-center">{p.name}</h3>
                  <p className="text-gray-600 mb-3">{p.price} บาท</p>
                  <button
                    onClick={() => addToCart(p)}
                    className={classNames(
                      "w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition",
                      added[p.id]
                        ? "bg-green-600 text-white"
                        : "bg-[#ac0000] text-[#fffff0] hover:opacity-90"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    {added[p.id] ? "Added!" : "Add to Cart"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cart footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
          <div className="max-w-5xl mx-auto flex justify-between items-center p-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <span>{totalQty} ชิ้น</span>
              <span className="font-semibold">{subtotal} บาท</span>
            </div>
            <button
              onClick={() => setCartOpen((s) => !s)}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            >
              {cartOpen ? "ปิดตะกร้า" : "เปิดตะกร้า"}
            </button>
          </div>

          {cartOpen && (
            <div className="max-w-5xl mx-auto border-t bg-white">
              <div className="p-3 space-y-3">
                {cart.map((i) => (
                  <div key={i.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <div className="font-semibold">{i.name}</div>
                      <div className="text-sm text-gray-600">
                        {i.price} บาท × {i.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(i.id, i.quantity - 1)}
                        className="p-1 border rounded"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span>{i.quantity}</span>
                      <button
                        onClick={() => changeQty(i.id, i.quantity + 1)}
                        className="p-1 border rounded"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(i.id)}
                        className="p-1 bg-red-500 text-white rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
