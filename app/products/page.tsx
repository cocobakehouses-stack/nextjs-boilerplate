// app/products/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Package, Loader2, Plus, Pencil, Save, X,
  ArrowUpNarrowWide, ArrowDownWideNarrow,
  Boxes, UploadCloud
} from 'lucide-react';
import HeaderMenu from '../components/HeaderMenu';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

type Product = { id: number; name: string; price: number; active?: boolean };

// ---- Stock Types ----
type LocationRow = { id: string; label: string };
type StockRow = { productId: number; name: string; price: number; qty: number };

type SortKey = 'id' | 'name' | 'price' | 'active';
type SortDir = 'asc' | 'desc';

const LS_KEY = 'products_list_state_v1';

export default function ProductsPage() {
  const { push } = useToast();

  // ------- tabs -------
  const [tab, setTab] = useState<'products' | 'stock'>('products');

  // ------- products -------
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

  // ------- stock panel -------
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [stockLoc, setStockLoc] = useState<string>(''); // ต้องเลือกสาขา
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockDirty, setStockDirty] = useState(false); // มีการแก้ไขค้างอยู่หรือไม่
  const [stockQ, setStockQ] = useState('');
  const [stockPending, setStockPending] = useState(false);

  // ---------- utils ----------
  function setPendingOn(id: number, on: boolean) {
    setPending(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  // ---------- load products ----------
  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setProducts(data?.products || []);
    } finally {
      setLoading(false);
    }
  }

  // ---------- load locations (for stock) ----------
  async function loadLocations() {
    try {
      const res = await fetch('/api/locations', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: LocationRow[] = data?.locations || [];
      setLocations(list);
      if (!stockLoc && list.length > 0) setStockLoc(list[0].id);
    } catch {
      setLocations([]);
    }
  }

  // init + restore persisted list state
  useEffect(() => {
    loadProducts();
    loadLocations();
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

  // ---------- toggle active ----------
  async function toggleActive(p: Product) {
    const current = p.active ?? true;
    const next = !current;
    // optimistic
    setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: next } : x)));
    setPendingOn(p.id, true);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      push({ type: 'success', message: `${p.name} → ${next ? 'Active' : 'Inactive'}` });
    } catch {
      // revert
      setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: current } : x)));
      push({ type: 'error', message: 'Toggle failed' });
    } finally {
      setPendingOn(p.id, false);
    }
  }

  // ---------- modal open (add / edit) ----------
  const nameRef = useRef<HTMLInputElement | null>(null);
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

  // ---------- modal save ----------
  async function submitModal() {
    if (modalBusy) return;
    const name = form.name.trim();
    // sanitize ราคา: อนุญาตตัวเลขและจุดเดียว
    const cleanPrice = form.price.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    const priceNum = Number(cleanPrice);
    if (!name || !Number.isFinite(priceNum) || priceNum <= 0) {
      push({ type: 'error', message: 'กรอกชื่อและราคาให้ถูกต้อง' });
      return;
    }
    setPendingOn(-1, true);
    try {
      if (editing) {
        // update
        const res = await fetch(`/api/products/${editing.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, price: priceNum, active: form.active }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Update failed');
        push({ type: 'success', message: 'อัปเดตเมนูสำเร็จ' });
      } else {
        // create
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

  // ---------- search debounce (products) ----------
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [q]);

  // ---------- search + sort view (products) ----------
  const viewProducts = useMemo(() => {
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

  // ---------- accessibility helpers ----------
  const sortLabel: Record<SortKey, string> = {
    id: 'ID',
    name: 'Name',
    price: 'Price',
    active: 'Active',
  };
  function ariaSortFor(k: SortKey): 'ascending' | 'descending' | 'none' {
    return sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  // ---------- modal key handlers ----------
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); submitModal(); }
      if (e.key === 'Escape') { e.preventDefault(); setModalOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, form, editing, modalBusy]);

  // =========================
  //        STOCK PANEL
  // =========================
  async function loadStock() {
    if (!stockLoc) return;
    setStockLoading(true);
    setStockDirty(false);
    try {
      // สมมติ endpoint: GET /api/stock?location=LOC
      const res = await fetch(`/api/stock?location=${encodeURIComponent(stockLoc)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: StockRow[] = data?.stock || [];
      setStockRows(list);
    } catch {
      setStockRows([]);
    } finally {
      setStockLoading(false);
    }
  }
  useEffect(() => { if (tab === 'stock' && stockLoc) loadStock(); }, [tab, stockLoc]);

  const viewStock = useMemo(() => {
    const s = stockQ.trim().toLowerCase();
    if (!s) return stockRows;
    return stockRows.filter(r => [r.productId, r.name, r.price, r.qty].join(' ').toLowerCase().includes(s));
  }, [stockRows, stockQ]);

  function updateQtyLocal(productId: number, nextQty: number) {
    setStockRows(prev => prev.map(r => (r.productId === productId ? { ...r, qty: nextQty } : r)));
    setStockDirty(true);
  }

  async function saveStock() {
    if (!stockLoc) return;
    setStockPending(true);
    try {
      // สมมติ endpoint: PATCH /api/stock/bulk  { location, updates: [{productId, qty}] }
      const updates = stockRows.map(r => ({ productId: r.productId, qty: r.qty }));
      const res = await fetch('/api/stock/bulk', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location: stockLoc, updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save stock failed');
      push({ type: 'success', message: 'บันทึกสต๊อกสำเร็จ' });
      setStockDirty(false);
      await loadStock();
    } catch (e: any) {
      push({ type: 'error', message: e?.message || 'Save stock failed' });
    } finally {
      setStockPending(false);
    }
  }

  const stockCsvHref = useMemo(() => {
    if (!stockLoc) return '#';
    // สมมติ endpoint: /api/stock/csv?location=LOC
    return `/api/stock/csv?location=${encodeURIComponent(stockLoc)}`;
  }, [stockLoc]);

  // =========================
  //          RENDER
  // =========================
  return (
    <main className="min-h-screen bg-[var(--surface-muted)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <HeaderMenu />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Title + Tabs */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-[var(--brand)]" />
            Products & Stock
          </h1>
          <div className="inline-flex rounded-lg border overflow-hidden">
            <button
              className={`px-3 py-2 text-sm ${tab==='products' ? 'bg-[var(--brand)] text-[var(--brand-contrast)]' : 'bg-white hover:bg-gray-50'}`}
              onClick={() => setTab('products')}
            >
              Products
            </button>
            <button
              className={`px-3 py-2 text-sm ${tab==='stock' ? 'bg-[var(--brand)] text-[var(--brand-contrast)]' : 'bg-white hover:bg-gray-50'}`}
              onClick={() => setTab('stock')}
            >
              Stock
            </button>
          </div>
        </div>

        {/* ================= PRODUCTS TAB ================= */}
        {tab === 'products' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="px-3 py-2 rounded-lg border bg-white w-56"
                />
              </div>
              <button
                onClick={openAdd}
                className="px-3 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {loading ? (
              <div className="grid gap-2">
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : viewProducts.length === 0 ? (
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
                    {viewProducts.map((p) => {
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

        {/* ================= STOCK TAB ================= */}
        {tab === 'stock' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Location</label>
                <select
                  className="rounded border px-3 py-2 bg-white"
                  value={stockLoc}
                  onChange={(e) => setStockLoc(e.target.value)}
                >
                  {locations.length === 0 ? (
                    <option>— ไม่มีสาขา —</option>
                  ) : (
                    locations.map(l => <option key={l.id} value={l.id}>{l.label} ({l.id})</option>)
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Search stock</label>
                <input
                  value={stockQ}
                  onChange={(e) => setStockQ(e.target.value)}
                  placeholder="ค้นหาด้วยชื่อ/ราคา/รหัส"
                  className="px-3 py-2 rounded-lg border bg-white w-64"
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <a
                  href={stockLoc ? `/api/stock/csv?location=${encodeURIComponent(stockLoc)}` : '#'}
                  onClick={(e) => { if (!stockLoc) e.preventDefault(); }}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                  title="Export CSV"
                >
                  <UploadCloud className="w-4 h-4 inline mr-1" />
                  Export CSV
                </a>
                <button
                  onClick={saveStock}
                  disabled={!stockDirty || stockPending || !stockLoc}
                  className="px-3 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  {stockPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save All
                </button>
                <button
                  onClick={loadStock}
                  disabled={!stockLoc || stockLoading}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <Boxes className="w-4 h-4" /> Reload
                </button>
              </div>
            </div>

            {(!stockLoc) ? (
              <div className="text-gray-600">กรุณาเลือกสาขาก่อน</div>
            ) : stockLoading ? (
              <div className="grid gap-2">
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : viewStock.length === 0 ? (
              <div className="p-10 text-center text-gray-600">ยังไม่มีข้อมูลสต๊อก</div>
            ) : (
              <div className="overflow-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewStock.map(r => (
                      <tr key={r.productId} className="border-t hover:bg-gray-50 transition">
                        <td className="px-3 py-2">{r.productId}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-right">{r.price.toLocaleString('en-US')}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            className="w-24 text-right rounded border px-2 py-1"
                            value={r.qty}
                            onChange={(e) => updateQtyLocal(r.productId, Math.max(0, Number(e.target.value) || 0))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Dirty indicator */}
            {stockDirty && (
              <div className="text-xs text-amber-600">มีการแก้ไขจำนวนที่ยังไม่บันทึก</div>
            )}
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
                // อนุญาตเฉพาะเลขและจุดเดียว
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
