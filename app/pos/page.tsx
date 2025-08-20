// app/pos/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import LocationPicker from '../components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products as FALLBACK_PRODUCTS } from '../data/products'; // ใช้เป็น fallback เท่านั้น

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
    const saved = (localStorage.getItem('pos_location') as LocationId | null) || null;
    if (saved) setLocation(saved);
  }, []);

  // Step flow
  const [step, setStep] = useState<Step>('cart');

  // Core states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [payment, setPayment] = useState<'cash' | 'promptpay' | null>(null);

  // ---------- Products from API (with fallback) ----------
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: Product[] = data?.products || [];
      if (list.length > 0) {
        setProducts(list);
      } else {
        setProducts(FALLBACK_PRODUCTS);
      }
    } catch {
      setProducts(FALLBACK_PRODUCTS);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Freebies
  const [freebies, setFreebies] = useState<Line[]>([]);
  const [freebiePick, setFreebiePick] = useState<number>(FALLBACK_PRODUCTS[0]?.id ?? 0);
  // ตั้งค่าเริ่มต้นของ freebiePick ใหม่เมื่อ products โหลดเสร็จ
  useEffect(() => {
    if (products.length > 0) setFreebiePick(products[0].id);
  }, [products]);

  // Date/Time
  const [dateStr, setDateStr] = useState<string>(toDateString(new Date()));
  const [timeStr, setTimeStr] = useState<string>(toTimeString(new Date()));

  // For success screen
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<{
    billNo: string; date: string; time: string; payment: 'cash' | 'promptpay'; total: number;
  } | null>(null);

  // ---------- Products: auto-sort + grouping ----------
  const allProducts = useMemo<Product[]>(() => {
    const merged = [...products]; // ใช้รายการจาก API (หรือ fallback ที่เซ็ตไว้)
    merged.sort((a, b) => b.price - a.price); // สูง → ต่ำ
    return merged;
  }, [products]);

  const grouped = useMemo(() => {
    const premium: Product[] = [];
    const levain: Product[] = [];
    const soft: Product[] = [];
    for (const p of allProducts) {
      if (p.price > 135) premium.push(p);
      else if (p.price > 125 && p.price <= 135) levain.push(p);
      else if (p.price <= 109) soft.push(p);
      // หมวด 110–125 ไม่ถูกแสดง; ถ้าต้องการรวมเข้าหมวด Soft ให้ใช้ else soft.push(p);
    }
    return { premium, levain, soft };
  }, [allProducts]);

  // ---------- Cart operations ----------
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
  const freebiesValue = useMemo(() => freebies.reduce((s, f) => s + f.price * f.qty, 0), [freebies]);
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const netTotal = useMemo(() => Math.max(0, subtotal - freebiesValue), [subtotal, freebiesValue]);

  // ---------- Freebies ops ----------
  const addFreebie = () => {
    const prod = allProducts.find((p) => p.id === freebiePick);
    if (!prod) return;
    setFreebies((prev) => {
      const idx = prev.findIndex((f) => f.name === prod.name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { name: prod.name, qty: 1, price: prod.price }];
    });
  };
  const changeFreebieQty = (name: string, qty: number) => {
    setFreebies((prev) => (qty <= 0 ? prev.filter((f) => f.name !== name) : prev.map((f) => (f.name === name ? { ...f, qty } : f))));
  };
  const removeFreebie = (name: string) => setFreebies((prev) => prev.filter((f) => f.name !== name));

  // ---------- เพิ่มเมนูใหม่ (เขียนลงแท็บ Products) ----------
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const addNewMenu = async () => {
    const name = newName.trim();
    const price = Number(String(newPrice).trim());
    if (!name || !Number.isFinite(price) || price <= 0) {
      alert('กรุณากรอกชื่อและราคาที่ถูกต้อง');
      return;
    }
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Add failed');
      setNewName('');
      setNewPrice('');
      await loadProducts(); // refresh รายการจากชีต
    } catch (e:any) {
      alert(e?.message || 'Add failed');
    } finally {
      setLoadingProducts(false);
    }
  };

  // ---------- Navigation ----------
  const goSummary = () => {
    if (!location) return alert('กรุณาเลือกสถานที่ก่อนใช้งาน');
    if (cart.length === 0) return alert('กรุณาเพิ่มสินค้าในตะกร้า');
    const now = new Date();
    setDateStr(toDateString(now));
    setTimeStr(toTimeString(now));
    setStep('summary');
  };

  const goConfirm = () => {
    if (!payment) return alert('กรุณาเลือกวิธีชำระเงิน');
    setStep('confirm');
  };

  const resetForNewBill = () => {
    setCart([]); setAdded({}); setPayment(null); setFreebies([]); setLastSaved(null); setStep('cart');
  };

  // ---------- UI ----------
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#fffff0]">
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Coco Bakehouse POS</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">
            Location: <b>{location ?? '— เลือกก่อนใช้งาน —'}</b>
          </span>
          <button
            onClick={() => { localStorage.removeItem('pos_location'); setLocation(null); }}
            className="px-3 py-1 rounded-lg border hover:bg-white"
          >
            เปลี่ยนสถานที่
          </button>
          {location && (
            <a
              className="px-3 py-1 rounded-lg border hover:bg-white"
              target="_blank"
              rel="noreferrer"
              href={`/history?location=${encodeURIComponent(location)}&date=${encodeURIComponent(dateStr)}`}
              title="Show history (open in new tab)"
            >
              Show history
            </a>
          )}
        </div>
      </div>

      {/* Location Gate */}
      <LocationPicker value={location} onChange={(loc) => setLocation(loc)} />

      {!location ? null : (
        <>
          {/* Stepper */}
          <div className="mb-4 flex gap-2 text-sm">
            {(['cart', 'summary', 'confirm', 'success'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={classNames(
                    'w-7 h-7 rounded-full flex items-center justify-center',
                    step === s ? 'bg-[#ac0000] text-[#fffff0]' : 'bg-white border'
                  )}
                >
                  {i + 1}
                </div>
                <span className={step === s ? 'font-semibold' : ''}>
                  {s === 'cart' ? 'Cart' : s === 'summary' ? 'Summary' : s === 'confirm' ? 'Confirm' : 'Success'}
                </span>
              </div>
            ))}
          </div>

          {/* CART */}
          {step === 'cart' && (
            <>
              {/* ✅ เพิ่มเมนูใหม่ */}
              <div className="bg-white border rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">เพิ่มเมนูใหม่ (บันทึกลง Google Sheets)</div>
                  <button
                    onClick={loadProducts}
                    className="px-3 py-1 rounded-lg border bg-white text-sm"
                    disabled={loadingProducts}
                  >
                    รีเฟรชเมนู
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-3 mt-3">
                  <input
                    className="rounded border px-3 py-2"
                    placeholder="ชื่อสินค้า"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <input
                    className="rounded border px-3 py-2"
                    placeholder="ราคา เช่น 129"
                    inputMode="decimal"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                  />
                  <button
                    onClick={addNewMenu}
                    className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
                    disabled={loadingProducts}
                  >
                    เพิ่มเมนู
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  * ระบบจะเพิ่มลงแท็บ <b>Products</b> ใน Google Sheets แล้วรีเฟรชรายการให้อัตโนมัติ
                </div>
              </div>

              {loadingProducts ? (
                <div className="text-gray-600 mb-4">Loading products…</div>
              ) : null}

              {[
                { title: 'Premium', items: grouped.premium },
                { title: 'Levain Cookies', items: grouped.levain },
                { title: 'Soft Cookies', items: grouped.soft },
              ].map(({ title, items }) =>
                items.length === 0 ? null : (
                  <div key={title} className="mb-6">
                    <h2 className="text-xl font-bold mb-3">{title}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {items.map((p) => (
                        <div key={p.id} className="border rounded-xl p-4 flex flex-col items-center bg-white">
                          <h3 className="text-lg font-semibold text-center">{p.name}</h3>
                          <p className="text-gray-600 mb-3">{p.price} THB</p>
                          <button
                            onClick={() => addToCart(p)}
                            className={classNames(
                              'mt-auto w-full px-4 py-2 rounded text-[#fffff0]',
                              added[p.id] ? 'bg-green-600' : 'bg-[#ac0000] hover:opacity-90'
                            )}
                          >
                            {added[p.id] ? 'Added!' : 'Add to Cart'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Sticky footer: Cart + ไปสรุปออเดอร์ */}
              <div className="fixed bottom-0 left-0 right-0 bg-[#fffff0]/95 backdrop-blur border-t">
                <div className="mx-auto max-w-6xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCartOpen((s) => !s)}
                      className="px-3 py-2 rounded-lg border bg-white"
                    >
                      {cartOpen ? 'ปิดตะกร้า' : `Cart (${totalQty})`}
                    </button>
                    <div className="text-sm">
                      รวมจำนวน: <b>{totalQty}</b> | ยอดรวม: <b>{subtotal}</b> THB
                    </div>
                  </div>
                  <button
                    onClick={goSummary}
                    className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
                    disabled={!location || cart.length === 0}
                  >
                    ไปสรุปออเดอร์
                  </button>
                </div>

                {/* Cart drawer (inline) */}
                {cartOpen && (
                  <div className="mx-auto max-w-6xl border-t bg-white">
                    <div className="p-3">
                      {cart.length === 0 ? (
                        <div className="text-gray-600">Cart is empty</div>
                      ) : (
                        <div className="space-y-3">
                          {cart.map((i) => (
                            <div key={i.id} className="flex justify-between items-center border-b pb-2">
                              <div>
                                <div className="font-semibold">{i.name}</div>
                                <div className="text-sm text-gray-600">
                                  {i.price} THB × {i.quantity}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => changeQty(i.id, i.quantity - 1)} className="px-2 py-1 border rounded">-</button>
                                <span>{i.quantity}</span>
                                <button onClick={() => changeQty(i.id, i.quantity + 1)} className="px-2 py-1 border rounded">+</button>
                                <button onClick={() => removeFromCart(i.id)} className="px-3 py-1 bg-red-500 text-white rounded">Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* spacer ให้ footer ไม่บัง content */}
              <div className="h-36" />
            </>
          )}

          {/* SUMMARY */}
          {step === 'summary' && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Items */}
              <div className="bg-white rounded-xl p-4 border">
                <div className="mb-2 text-sm text-gray-600">
                  <b>Bill No.:</b> (ระบบจะออกให้) &nbsp; | &nbsp;
                  <b>Time:</b> {timeStr} &nbsp; <b>Date:</b> {dateStr} &nbsp; <b>Payment:</b>{' '}
                  <span className="text-gray-500">{payment ?? '— ยังไม่เลือก —'}</span>
                </div>

                <h3 className="font-semibold mb-2">รายการสินค้า</h3>
                {cart.length === 0 ? (
                  <p className="text-gray-600">Cart is empty</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((i) => (
                      <div key={i.id} className="flex justify-between text-sm border-b pb-1">
                        <div>{i.name} × {i.quantity}</div>
                        <div>{i.price * i.quantity} THB</div>
                      </div>
                    ))}
                    <div className="pt-2 text-right">
                      <div>Subtotal: <b>{subtotal}</b> THB</div>
                      <div className="text-green-700">Freebies (-): <b>{freebiesValue}</b> THB</div>
                      <div className="text-lg">Total: <b>{netTotal}</b> THB</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Payment + Freebies */}
              <div className="bg-white rounded-xl p-4 border">
                <h3 className="font-semibold mb-2">วิธีชำระเงิน</h3>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setPayment('cash')}
                    className={classNames('px-4 py-2 rounded-lg border', payment === 'cash' ? 'bg-[#ac0000] text-[#fffff0] border-[#ac0000]' : 'hover:bg-gray-50')}
                  >
                    เงินสด
                  </button>
                  <button
                    onClick={() => setPayment('promptpay')}
                    className={classNames('px-4 py-2 rounded-lg border', payment === 'promptpay' ? 'bg-[#ac0000] text-[#fffff0] border-[#ac0000]' : 'hover:bg-gray-50')}
                  >
                    พร้อมเพย์
                  </button>
                </div>

                <h3 className="font-semibold mb-2">ของแถม (Freebies)</h3>
                <div className="flex gap-2 items-center">
                  <select
                    className="rounded-lg border px-3 py-2"
                    value={freebiePick}
                    onChange={(e) => setFreebiePick(Number(e.target.value))}
                  >
                    {allProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price} THB)
                      </option>
                    ))}
                  </select>
                  <button onClick={addFreebie} className="px-3 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90">
                    เพิ่มของแถม
                  </button>
                </div>

                {freebies.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {freebies.map((f) => (
                      <div key={f.name} className="flex items-center justify-between border-b pb-1">
                        <div className="text-sm">{f.name} × {f.qty} <span className="text-gray-500">({f.price} THB/ชิ้น)</span></div>
                        <div className="flex items-center gap-2">
                          <button className="px-2 py-1 border rounded" onClick={() => changeFreebieQty(f.name, f.qty - 1)}>-</button>
                          <span>{f.qty}</span>
                          <button className="px-2 py-1 border rounded" onClick={() => changeFreebieQty(f.name, f.qty + 1)}>+</button>
                          <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={() => removeFreebie(f.name)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep('cart')} className="px-4 py-2 rounded-lg border hover:bg-gray-50">กลับไปแก้</button>
                  <button onClick={goConfirm} className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90">ยืนยัน</button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRM */}
          {step === 'confirm' && (
            <div className="bg-white rounded-xl p-6 border max-w-xl">
              <h2 className="text-2xl font-bold mb-4">ยืนยันส่งข้อมูล</h2>

              <div className="space-y-2 text-sm">
                <div><b>BillNo:</b> (ระบบจะออกให้)</div>
                <div><b>Time:</b> {timeStr}</div>
                <div><b>Date:</b> {dateStr}</div>
                <div><b>Payment:</b> {payment}</div>
                <div><b>Total:</b> {netTotal} THB</div>
              </div>

              <div className="mt-6 flex gap-2">
                <button onClick={() => setStep('summary')} className="px-4 py-2 rounded-lg border hover:bg-gray-50" disabled={isSubmitting}>
                  กลับไปแก้
                </button>
                <button
                  onClick={async () => {
                    if (!location || !payment) return;
                    // ส่งไป /api/orders
                    const itemsPayload: Line[] = cart.map((i) => ({ name: i.name, qty: i.quantity, price: i.price }));
                    const body = {
                      location,
                      date: dateStr,
                      time: /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr) ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr) : toTimeString(new Date()),
                      payment,
                      items: itemsPayload,
                      freebies,
                      total: Number(netTotal.toFixed(2)),
                    };
                    try {
                      setSubmitting(true);
                      const res = await fetch('/api/orders', {
                        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data?.error || 'Submit failed');

                      const saved = data?.saved ?? {};
                      setLastSaved({
                        billNo: saved.billNo ?? '(auto)',
                        date: saved.date ?? body.date,
                        time: saved.time ?? body.time,
                        payment: saved.payment ?? payment,
                        total: Number(saved.total ?? body.total),
                      });
                      setStep('success');
                    } catch (e: any) {
                      alert(`บันทึกไม่สำเร็จ: ${e?.message || e}`);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className={classNames('px-4 py-2 rounded-lg text-[#fffff0]', isSubmitting ? 'bg-gray-400' : 'bg-[#ac0000] hover:opacity-90')}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'กำลังบันทึก…' : 'ยืนยันส่งไป Google Sheets'}
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && lastSaved && (
            <div className="bg-white rounded-xl p-6 border max-w-xl">
              <h2 className="text-2xl font-bold mb-4 text-green-700">บันทึกสำเร็จ 🎉</h2>
              <div className="space-y-2 text-sm">
                <div><b>BillNo:</b> {lastSaved.billNo}</div>
                <div><b>Time:</b> {lastSaved.time}</div>
                <div><b>Date:</b> {lastSaved.date}</div>
                <div><b>Payment:</b> {lastSaved.payment}</div>
                <div><b>Total:</b> {lastSaved.total} THB</div>
              </div>
              <div className="mt-6">
                <button onClick={resetForNewBill} className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90">
                  เริ่มบิลใหม่
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
