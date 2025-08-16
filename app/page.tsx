'use client';

import { useEffect, useMemo, useState } from 'react';
import LocationPicker from './components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products } from '../data/products';

// types
type Product = { id: number; name: string; price: number };
type CartItem = Product & { quantity: number };

export default function Home() {
  // ⭐ ต้องเลือก location ก่อน
  const [location, setLocation] = useState<LocationId | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pos_location') as LocationId | null;
    if (saved) setLocation(saved);
  }, []);

  // ตะกร้า
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addedItems, setAddedItems] = useState<Record<number, boolean>>({});

  const addToCart = (product: Product) => {
    const existing = cart.find((i) => i.id === product.id);
    if (existing) {
      setCart(cart.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setAddedItems((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => setAddedItems((prev) => ({ ...prev, [product.id]: false })), 800);
  };

  const updateQty = (id: number, q: number) =>
    setCart((prev) => (q <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity: q } : i))));

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((i) => i.id !== id));

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);

  return (
    <main className="p-6 sm:p-8">
      {/* แสดงหัว + สถานที่ ถ้าเลือกแล้ว */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Coco Bakehouse POS</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Location: <b>{location ?? '— เลือกก่อนใช้งาน —'}</b></span>
          {location && (
            <button
              onClick={() => { localStorage.removeItem('pos_location'); setLocation(null); }}
              className="px-3 py-1 rounded-lg border hover:bg-gray-50"
            >
              เปลี่ยนสถานที่
            </button>
          )}
        </div>
      </div>

      {/* ❗ถ้ายังไม่ได้เลือก location — บล็อคหน้าขายด้วยตัวเลือกเต็มจอ */}
      <LocationPicker value={location} onChange={(loc) => setLocation(loc)} />
      {!location ? null : (
        <>
          {/* Products */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.id} className="border rounded-xl p-4 flex flex-col items-center">
                <h2 className="text-lg font-semibold text-center">{p.name}</h2>
                <p className="text-gray-600 mb-2">{p.price} THB</p>
                <button
                  onClick={() => addToCart(p)}
                  className={`mt-auto w-full px-4 py-2 rounded text-white ${addedItems[p.id] ? 'bg-green-500' : 'bg-blue-600 hover:brightness-110'}`}
                >
                  {addedItems[p.id] ? 'Added!' : 'Add to Cart'}
                </button>
              </div>
            ))}
          </div>

          {/* Cart */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Cart</h2>
            {cart.length === 0 ? (
              <p>Cart is empty</p>
            ) : (
              <div className="space-y-4">
                {cart.map((i) => (
                  <div key={i.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h3 className="font-semibold">{i.name}</h3>
                      <p>{i.price} THB × {i.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(i.id, i.quantity - 1)} className="px-2 py-1 border rounded">-</button>
                      <span>{i.quantity}</span>
                      <button onClick={() => updateQty(i.id, i.quantity + 1)} className="px-2 py-1 border rounded">+</button>
                      <button onClick={() => removeFromCart(i.id)} className="px-3 py-1 bg-red-500 text-white rounded">Remove</button>
                    </div>
                  </div>
                ))}
                <div className="text-right font-bold">Total: {total} THB</div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
