// app/products/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Package, Loader2, Plus, Pencil, Save, X, RotateCw,
  ArrowUpNarrowWide, ArrowDownWideNarrow, Minus, Plus as PlusIcon, Database
} from 'lucide-react';
import HeaderMenu from '../components/HeaderMenu';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import LocationPicker from '../components/LocationPicker'; // ใช้กับแท็บ Stock

type Product = { id: number; name: string; price: number; active?: boolean };

type SortKey = 'id' | 'name' | 'price' | 'active';
type SortDir = 'asc' | 'desc';

type StockRow = { productId: number; name: string; qty: number };

const LS_KEY = 'products_list_state_v1';

export default function ProductsPage() {
  const { push } = useToast();

  // -------------------- Shared / Tabs --------------------
  const [tab, setTab] = useState<'products' | 'stock'>('products');

  // -------------------- PRODUCTS TAB --------------------
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<number>>(new Set()); // ids ที่กำลังอัปเดต

  // search & sort (จำสถานะไว้)
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<{ name: string; price: string; active: boolean }>({ name: '', price: '', active: true });
  const modalBusy = pending.has(-1); // ใช้ -1 เป็น flag ตอนบันทึกโมดอล

  function setPendingOn(id: number, on: boolean) {
    setPending(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setProducts(data?.products || []);
    } catch {
      push({ type: 'error', message: 'โหลดสินค้าไม่สำเร็จ' });
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  // init + restore persisted list state
  useEffect(() => {
    loadProducts();
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.q) setQ(String(s.q));
        if (s.sortKey) setSortKey(s.sortKey);
        if (s.sortDir) setSortDir(s.sortDir);
      }
    } catch {}
  }, []);

  // persist list state
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ q, sortKey, sortDir })); } catch {}
  }, [q, sortKey, sortDir]);

  async function toggleActive(p: Product) {
    const current = p.active ?? true;
    const next = !current;
    setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: next } : x)));
    setPendingOn(p.id, true);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Toggle failed');
      push({ type: 'success', message: `${p.name} → ${next ? 'Active' : 'Inactive'}` });
    } catch (e: any) {
      setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: current } : x)));
      push({ type: 'error', message: e?.message || 'Toggle failed' });
    } finally {
      setPendingOn(p.id, false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', price: '', active: true });
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, price: String(p.price), active: p.active ?? true });
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  async function submitModal() {
    if (modalBusy) return;
    const name = form.name.trim();
    const cleanPrice = form.price.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    const priceNum = Number(cleanPrice);
    if (!name || !Number.isFinite(priceNum) || priceNum <= 0) {
      push({ type: 'error', message: 'กรอกชื่อและราคาให้ถูกต้อง' });
      return;
    }
    setPendingOn(-1, true);
    try {
      if (editing) {
        const res = await fetch(`/api/products/${editing.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, price: priceNum, active: form.active }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Update failed');
        push({ type: 'success', message: 'อัปเดตเมนูสำเร็จ' });
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, price: priceNum }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Create failed');
        push({ type: 'success', message: 'เพิ่มเมนูสำเร็จ' });
      }
      await loadProducts();
      setModalOpen(false);
    } catch (e: any) {
      push({ type: 'error', message: e?.message || 'Save failed' });
    } finally {
      setPendingOn(-1, false);
    }
  }

  // search debounce
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [q]);

  // search + sort view
  const view = useMemo(() => {
    const f = products.filter(p => {
      if (!qDebounced) return true;
      const s = [p.id, p.name, p.price, (p.active ?? true) ? 'active' : 'inactive'].join(' ').toLowerCase();
      return s.includes(qDebounced);
    });
    const sign = sortDir === 'asc' ? 1 : -1;
    f.sort((a, b) => {
      const va =
        sortKey === 'name' ? a.name.toLowerCase()
        : sortKey === 'price' ? a.price
        : sortKey === 'active' ? Number(a.active ?? true)
        : a.id;
      const vb =
        sortKey === 'name' ? b.name.toLowerCase()
        : sortKey === 'price' ? b.price
        : sortKey === 'active' ? Number(b.active ?? true)
        : b.id;
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
    return f;
  }, [products, qDebounced, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    setSortKey(prev => (prev === k ? prev : k));
    setSortDir(prev => (sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
  }

  const sortLabel: Record<SortKey, string> = { id: 'ID', name: 'Name', price: 'Price', active: 'Active' };
  function ariaSortFor(k: SortKey): 'ascending' | 'descending' | 'none' {
    return sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); submitModal(); }
      if (e.key === 'Escape') { e.preventDefault(); setModalOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, form, editing, modalBusy]);

  // -------------------- STOCK TAB --------------------
  const [locId, setLocId] = useState<string | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [pendingStock, setPendingStock] = useState<Set<number>>(new Set()); // productId กำลังอัปเดต

  async function loadStock(location: string) {
    setLoadingStock(true);
    setStock([]);
    try {
      // รูปแบบ API ที่คุยกัน: /api/stock?location=XYZ
      // รองรับ fallback ถ้า backend ยังไม่พร้อม
      const res = await fetch(`/api/stock?location=${encodeURIComponent(location)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      let items: StockRow[] = [];
      if (Array.isArray(data?.items)) {
        // คาดว่าเป็น [{productId, name?, qty}]
        items = data.items.map((it: any) => ({
          productId: Number(it.productId),
          name: it.name ?? (products.find(p => p.id === Number(it.productId))?.name || `#${it.productId}`),
          qty: Number(it.qty) || 0,
        }));
      } else {
        // fallback: ไม่มีสต๊อก → สร้างจาก products ทั้งหมดด้วย qty = 0
        items = products.map(p => ({ productId: p.id, name: p.name, qty: 0 }));
      }
      // sort ตามชื่อเพื่ออ่านง่าย
      items.sort((a, b) => a.name.localeCompare(b.name, 'en'));
      setStock(items);
    } catch {
      push({ type: 'error', message: 'โหลดสต๊อกไม่สำเร็จ' });
      setStock([]);
    } finally {
      setLoadingStock(false);
    }
  }

  // เมื่อเลือก location แล้วค่อยโหลดสต๊อก
  useEffect(() => {
    if (!locId) return;
    loadStock(locId);
  }, [locId, products]); // ถ้ารายการสินค้าเปลี่ยน ให้ refresh สต๊อกด้วย (ชื่อจะตรง)

  function setStockPendingOn(productId: number, on: boolean) {
    setPendingStock(prev => {
      const next = new Set(prev);
      if (on) next.add(productId); else next.delete(productId);
      return next;
    });
  }

  async function changeStockQty(productId: number, delta: number) {
    if (!locId) return;
    setStockPendingOn(productId, true);
    // optimistic
    setStock(prev => prev.map(r => r.productId === productId ? { ...r, qty: Math.max(0, r.qty + delta) } : r));
    try {
      const res = await fetch('/api/stock', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location: locId, productId, delta }),
      });
      if (!res.ok) throw new Error('Update stock failed');
      // success → ไม่ทำอะไรเพิ่ม (เชื่อค่า optimistic)
    } catch (e: any) {
      // revert
      setStock(prev => prev.map(r => r.productId === productId ? { ...r, qty: Math.max(0, r.qty - delta) } : r));
      push({ type: 'error', message: e?.message || 'อัปเดตสต๊อกไม่สำเร็จ' });
    } finally {
      setStockPendingOn(productId, false);
    }
  }

  async function setStockQty(productId: number, qty: number) {
    if (!locId) return;
    const prevRow = stock.find(r => r.productId === productId);
    const prev = prevRow?.qty ?? 0;
    if (qty === prev) return;

    setStockPendingOn(productId, true);
    // optimistic
    setStock(prevList => prevList.map(r => r.productId === productId ? { ...r, qty: Math.max(0, qty) } : r));
    try {
      const res = await fetch('/api/stock', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location: locId, productId, qty }),
      });
      if (!res.ok) throw new Error('Set stock failed');
    } catch (e: any) {
      // revert
      setStock(prevList => prevList.map(r => r.productId === productId ? { ...r, qty: prev } : r));
      push({ type: 'error', message: e?.message || 'ตั้งค่าสต๊อกไม่สำเร็จ' });
    } finally {
      setStockPendingOn(productId, false);
    }
  }

  // -------------------- RENDER --------------------
  return (
    <main className="min-h-screen bg-[var(--surface-muted)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <HeaderMenu />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setTab('products')}
            className={`px-3 py-2 rounded-lg border ${tab==='products' ? 'bg-[var(--brand)] text-[var(--brand-contrast)]' : 'bg-white hover:bg-gray-50'}`}
          >
            <span className="inline-flex items-center gap-1"><Package className="w-4 h-4" /> Products</span>
          </button>
          <button
            onClick={() => setTab('stock')}
            className={`px-3 py-2 rounded-lg border ${tab==='stock' ? 'bg-[var(--brand)] text-[var(--brand-contrast)]' : 'bg-white hover:bg-gray-50'}`}
          >
            <span className="inline-flex items-center gap-1"><Database className="w-4 h-4" /> Stock</span>
          </button>
        </div>

        {/* ==================== TAB: PRODUCTS ==================== */}
        {tab === 'products' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6 text-[var(--brand)]" />
                Manage Products
              </h1>
              <div className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="px-3 py-2 rounded-lg border bg-white w-56"
                />
                <button
                  onClick={loadProducts}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                  title="Reload"
                >
                  <RotateCw className="w-4 h-4" /> Reload
                </button>
                <button
                  onClick={openAdd}
                  className="px-3 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 inline-flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-2">
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : view.length === 0 ? (
              <div className="p-10 text-center text-gray-600">ไม่พบสินค้า</div>
            ) : (
              <div className="overflow-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      {(['id','name','price','active'] as SortKey[]).map(k => (
                        <th
                          key={k}
                          scope="col"
                          role="columnheader"
                          aria-sort={ariaSortFor(k)}
                          className={`px-3 py-2 ${k==='price' ? 'text-right' : k==='active' ? 'text-center' : 'text-left'} cursor-pointer select-none`}
                          onClick={() => toggleSort(k)}
                          title={`Sort by ${sortLabel[k]}`}
                        >
                          <div className={`inline-flex items-center gap-1 ${sortKey===k ? 'font-medium' : ''}`}>
                            {sortLabel[k]}
                            {sortKey === k ? (
                              sortDir === 'asc'
                                ? <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                                : <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                            ) : null}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.map((p) => {
                      const isActive = p.active ?? true;
                      const isPending = pending.has(p.id);
                      return (
                        <tr key={p.id} className="border-t hover:bg-gray-50 transition">
                          <td className="px-3 py-2">{p.id}</td>
                          <td className="px-3 py-2">{p.name}</td>
                          <td className="px-3 py-2 text-right">{p.price.toLocaleString('en-US', { minimumFractionDigits: 0 })}</td>
                          <td className="px-3 py-2 text-center">
                            <label className={`inline-flex items-center ${isPending ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!isActive}
                                onChange={() => toggleActive(p)}
                                disabled={isPending}
                                aria-label={`Toggle ${p.name}`}
                              />
                              <div className="
                                relative w-11 h-6 rounded-full bg-gray-200 transition
                                peer-focus:ring-2 peer-focus:ring-[var(--brand)]
                                peer-checked:bg-green-600
                                after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                after:w-5 after:h-5 after:rounded-full after:bg-white after:border after:transition-all
                                peer-checked:after:translate-x-5
                              " />
                              <span className="ml-2 text-xs text-gray-600">
                                {isActive ? 'Active' : 'Inactive'}{isPending ? '…' : ''}
                              </span>
                            </label>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => openEdit(p)}
                              className="px-2 py-1 rounded border hover:bg-gray-100 inline-flex items-center gap-1"
                            >
                              <Pencil className="w-4 h-4" /> Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: STOCK ==================== */}
        {tab === 'stock' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Database className="w-5 h-5 text-[var(--brand)]" />
                Stock by Location
              </h2>
              <div className="flex items-center gap-2">
                <LocationPicker value={locId} onChange={(id) => setLocId(id)} includeAll={false} />
                <button
                  onClick={() => locId && loadStock(locId)}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 inline-flex items-center gap-1"
                  disabled={!locId}
                  title="Reload stock"
                >
                  <RotateCw className="w-4 h-4" /> Reload
                </button>
              </div>
            </div>

            {!locId ? (
              <div className="p-10 text-center text-gray-600">เลือกสาขาก่อนค่ะ</div>
            ) : loadingStock ? (
              <div className="grid gap-2">
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : stock.length === 0 ? (
              <div className="p-10 text-center text-gray-600">ไม่พบข้อมูลสต๊อกสำหรับสาขานี้</div>
            ) : (
              <div className="overflow-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Adjust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map(row => {
                      const pending = pendingStock.has(row.productId);
                      return (
                        <tr key={row.productId} className="border-t hover:bg-gray-50 transition">
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-right">{row.qty}</td>
                          <td className="px-3 py-2">
                            <div className={`flex justify-end items-center gap-2 ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
                              <button
                                onClick={() => changeStockQty(row.productId, -1)}
                                className="px-2 py-1 rounded border hover:bg-gray-100 inline-flex items-center"
                                aria-label="decrease"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                className="w-20 rounded border px-2 py-1 text-right"
                                defaultValue={row.qty}
                                onBlur={(e) => {
                                  const v = Math.max(0, Number(e.target.value) || 0);
                                  if (v !== row.qty) setStockQty(row.productId, v);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const v = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
                                    if (v !== row.qty) setStockQty(row.productId, v);
                                  }
                                }}
                              />
                              <button
                                onClick={() => changeStockQty(row.productId, +1)}
                                className="px-2 py-1 rounded border hover:bg-gray-100 inline-flex items-center"
                                aria-label="increase"
                              >
                                <PlusIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-3">
              หมายเหตุ: ปุ่ม +/- ใช้ปรับสต๊อกแบบเร็ว (delta) ส่วนช่องตัวเลขจะตั้งค่าเป็นจำนวนใหม่ทันทีเมื่อกด Enter หรือออกจากช่อง
            </p>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Product' : 'Add Product'}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 inline-flex items-center gap-1">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={submitModal}
              disabled={modalBusy}
              className="px-3 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-40"
            >
              {modalBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input
              ref={nameRef}
              value={form.name}
              onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="เช่น Chocolate Chunk"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Price</label>
            <input
              value={form.price}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                setForm(s => ({ ...s, price: v }));
              }}
              inputMode="decimal"
              className="w-full rounded-lg border px-3 py-2"
              placeholder="เช่น 135"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm(s => ({ ...s, active: e.target.checked }))}
              />
              <span>Active</span>
            </label>
          </div>
        </div>
      </Modal>
    </main>
  );
}
