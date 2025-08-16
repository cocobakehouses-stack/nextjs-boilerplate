'use client';

import { useEffect, useMemo, useState } from 'react';
import LocationPicker from './components/LocationPicker';
import type { LocationId } from '../data/locations';
import { products } from '../data/products';

// ---------- Types ----------
type Product = { id: number; name: string; price: number };
type CartItem = Product & { quantity: number };
type Line = { name: string; qty: number; price: number };

type Step = 'cart' | 'summary' | 'confirm' | 'success';

// ---------- Helpers ----------
const TZ = 'Asia/Bangkok';

function toDateString(d: Date) {
  // YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
function toTimeString(d: Date) {
  // HH:MM:SS (24h)
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(/\./g, ':'); // กันบาง locale ใส่จุด
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

// ---------- Page ----------
export default function Home() {
  // Location (ต้องเลือกก่อนใช้งาน)
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
  const [billNo, setBillNo] = useState<string>(''); // ต้องมีทุกบิล
  const [payment, setPayment] = useState<'cash' | 'promptpay' | null>(null);

  // Freebies: เลือกได้หลายชิ้นจาก products (หักราคาออกจากยอด)
  const [freebies, setFreebies] = useState<Line[]>([]);
  const [freebiePick, setFreebiePick] = useState<number>(products[0]?.id ?? 0);

  // Date/Time (แยกช่องชัดเจน)
  const [dateStr, setDateStr] = useState<string>(toDateString(new Date()));
  const [timeStr, setTimeStr] = useState<string>(toTimeString(new Date()));

  // สำหรับแสดงผลหลังบันทึก
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<{
    billNo: string;
    date: string;
    time: string;
    payment: 'cash' | 'promptpay';
    total: number;
  } | null>(null);

  // --- Cart operations ---
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

  // --- Totals ---
  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart]
  );

  const freebiesValue = useMemo(
    () => freebies.reduce((s, f) => s + f.price * f.qty, 0),
    [freebies]
  );

  const totalQty = useMemo(
    () => cart.reduce((s, i) => s + i.quantity, 0),
    [cart]
  );

  const netTotal = useMemo(() => Math.max(0, subtotal - freebiesValue), [subtotal, freebiesValue]);

  // --- Freebies ops ---
  const addFreebie = () => {
    const prod = products.find((p) => p.id === freebiePick);
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
    setFreebies((prev) => {
      if (qty <= 0) return prev.filter((f) => f.name !== name);
      return prev.map((f) => (f.name === name ? { ...f, qty } : f));
    });
  };

  const removeFreebie = (name: string) => {
    setFreebies((prev) => prev.filter((f) => f.name !== name));
  };

  // --- Navigation guards ---
  const goSummary = () => {
    if (!location) {
      alert('กรุณาเลือกสถานที่ก่อนใช้งาน');
      return;
    }
    if (cart.length === 0) {
      alert('กรุณาเพิ่มสินค้าในตะกร้า');
      return;
    }
    // fill date/time ตอนกดไปสรุปอีกครั้งเพื่อความสดใหม่
    const now = new Date();
    setDateStr(toDateString(now));
    setTimeStr(toTimeString(now));
    setStep('summary');
  };

  const goConfirm = () => {
    if (!billNo.trim()) {
      alert('กรุณาใส่ Bill No.');
      return;
    }
    if (!payment) {
      alert('กรุณาเลือกวิธีชำระเงิน');
      return;
    }
    setStep('confirm');
  };

  const resetForNewBill = () => {
    setCart([]);
    setAdded({});
    setPayment(null);
    setBillNo('');
    setFreebies([]);
    setLastSaved(null);
    setStep('cart');
  };

  // --- API submit ---
  const submitOrder = async () => {
    if (!location || !payment) return;

    const itemsPayload: Line[] = cart.map((i) => ({
      name: i.name,
      qty: i.quantity,
      price: i.price,
    }));

    const body = {
      location,                // FLAGSHIP | SINDHORN | CHIN3
      billNo: billNo.trim(),   // "012"
      date: dateStr,           // "YYYY-MM-DD"
      time: /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr) ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr) : toTimeString(new Date()),
      payment,                 // 'cash' | 'promptpay'
      items: itemsPayload,
      freebies,                // [{name, qty, price}]
      total: Number(netTotal.toFixed(2)),
    };

    try {
      setSubmitting(true);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Submit failed');
      }
      setLastSaved({
        billNo: body.billNo,
        date: body.date,
        time: body.time,
        payment: body.payment,
        total: body.total,
      });
      setStep('success');
    } catch (e: any) {
      alert(`บันทึกไม่สำเร็จ: ${e?.message || e}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI ----------
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
            onClick={() => {
              localStorage.removeItem('pos_location');
              setLocation(null);
            }}
            className="px-3 py-1 rounded-lg border hover:bg-white"
          >
            เปลี่ยนสถานที่
          </button>
          {/* Show history */}
          {location && (
            <a
              className="px-3 py-1 rounded-lg border hover:bg-white"
              target="_blank"
              rel="noreferrer"
              href={`/history?location=${encodeURIComponent(location)}&date=${encodeURIComponent(
                dateStr
              )}`}
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
          {/* Stepper (simple) */}
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
              {/* Products grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((p) => (
                  <div key={p.id} className="border rounded-xl p-4 flex flex-col items-center bg-white">
                    <h2 className="text-lg font-semibold text-center">{p.name}</h2>
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

              {/* Cart list */}
              <div className="mt-8 bg-white rounded-xl p-4 border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-bold">Cart</h2>
                  <div className="text-sm text-gray-700">
                    รวมจำนวน: <b>{totalQty}</b> | ยอดรวม: <b>{subtotal} THB</b>
                  </div>
                </div>

                {cart.length === 0 ? (
                  <p className="text-gray-600">Cart is empty</p>
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
                          <button
                            onClick={() => changeQty(i.id, i.quantity - 1)}
                            className="px-2 py-1 border rounded"
                          >
                            -
                          </button>
                          <span>{i.quantity}</span>
                          <button
                            onClick={() => changeQty(i.id, i.quantity + 1)}
                            className="px-2 py-1 border rounded"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(i.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sticky action bar */}
              <div className="fixed bottom-0 left-0 right-0 bg-[#fffff0]/95 backdrop-blur border-t">
                <div className="mx-auto max-w-6xl p-3 flex items-center justify-between">
                  <div className="text-sm">
                    รวมจำนวน: <b>{totalQty}</b> | ยอดรวม: <b>{subtotal} THB</b>
                  </div>
                  <button
                    onClick={goSummary}
                    className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90 disabled:opacity-40"
                    disabled={!location || cart.length === 0}
                  >
                    ไปสรุปออเดอร์
                  </button>
                </div>
              </div>
              <div className="h-16" />
            </>
          )}

          {/* SUMMARY */}
          {step === 'summary' && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Bill + Items */}
              <div className="bg-white rounded-xl p-4 border">
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1">Bill No.</label>
                  <input
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    placeholder="เช่น 001, 012, ..."
                    className="w-full rounded-lg border px-3 py-2"
                  />
                  <div className="mt-2 text-sm text-gray-600">
                    <b>Time:</b> {timeStr} &nbsp; <b>Date:</b> {dateStr} &nbsp; <b>Payment:</b>{' '}
                    <span className="text-gray-500">{payment ?? '— ยังไม่เลือก —'}</span>
                  </div>
                </div>

                <h3 className="font-semibold mb-2">รายการสินค้า</h3>
                {cart.length === 0 ? (
                  <p className="text-gray-600">Cart is empty</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((i) => (
                      <div key={i.id} className="flex justify-between text-sm border-b pb-1">
                        <div>
                          {i.name} × {i.quantity}
                        </div>
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
                    className={classNames(
                      'px-4 py-2 rounded-lg border',
                      payment === 'cash' ? 'bg-[#ac0000] text-[#fffff0] border-[#ac0000]' : 'hover:bg-gray-50'
                    )}
                  >
                    เงินสด
                  </button>
                  <button
                    onClick={() => setPayment('promptpay')}
                    className={classNames(
                      'px-4 py-2 rounded-lg border',
                      payment === 'promptpay' ? 'bg-[#ac0000] text-[#fffff0] border-[#ac0000]' : 'hover:bg-gray-50'
                    )}
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
                    {products.map((p) => (
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
                        <div className="text-sm">
                          {f.name} × {f.qty} <span className="text-gray-500">({f.price} THB/ชิ้น)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 border rounded"
                            onClick={() => changeFreebieQty(f.name, f.qty - 1)}
                          >
                            -
                          </button>
                          <span>{f.qty}</span>
                          <button
                            className="px-2 py-1 border rounded"
                            onClick={() => changeFreebieQty(f.name, f.qty + 1)}
                          >
                            +
                          </button>
                          <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={() => removeFreebie(f.name)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => setStep('cart')}
                    className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                  >
                    กลับไปแก้
                  </button>
                  <button
                    onClick={goConfirm}
                    className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90"
                  >
                    ยืนยัน
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRM */}
          {step === 'confirm' && (
            <div className="bg-white rounded-xl p-6 border max-w-xl">
              <h2 className="text-2xl font-bold mb-4">ยืนยันส่งข้อมูล</h2>

              <div className="space-y-2 text-sm">
                <div><b>BillNo:</b> {billNo}</div>
                <div><b>Time:</b> {timeStr}</div>
                <div><b>Date:</b> {dateStr}</div>
                <div><b>Payment:</b> {payment}</div>
                <div><b>Total:</b> {netTotal} THB</div>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setStep('summary')}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  กลับไปแก้
                </button>
                <button
                  onClick={submitOrder}
                  className={classNames(
                    'px-4 py-2 rounded-lg text-[#fffff0]',
                    isSubmitting ? 'bg-gray-400' : 'bg-[#ac0000] hover:opacity-90'
                  )}
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
                <button
                  onClick={resetForNewBill}
                  className="px-4 py-2 rounded-lg bg-[#ac0000] text-[#fffff0] hover:opacity-90"
                >
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
