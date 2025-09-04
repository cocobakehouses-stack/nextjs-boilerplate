'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Loader2, Plus, Pencil, Save, X } from 'lucide-react';
import HeaderMenu from '../components/HeaderMenu';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

type Product = { id: number; name: string; price: number; active?: boolean };

export default function ProductsPage() {
  const { push } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<number>>(new Set());

  // search & sort
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<'id'|'name'|'price'|'active'>('id');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<{ name: string; price: string; active: boolean }>({ name:'', price:'', active:true });
  const modalBusy = pending.has(-1); // ใช้ -1 เป็น flag ตอนบันทึกโมดอล

  function setPendingOn(id: number, on: boolean) {
    setPending(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setProducts(data?.products || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // toggle active
  async function toggleActive(p: Product) {
    const current = p.active ?? true;
    const next = !current;
    setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: next } : x)));
    setPendingOn(p.id, true);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      push({ type:'success', message:`${p.name} -> ${next?'Active':'Inactive'}` });
    } catch {
      setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: current } : x)));
      push({ type:'error', message:'Toggle failed' });
    } finally {
      setPendingOn(p.id, false);
    }
  }

  // open modal (add / edit)
  function openAdd() {
    setEditing(null);
    setForm({ name:'', price:'', active:true });
    setModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name:p.name, price:String(p.price), active: p.active ?? true });
    setModalOpen(true);
  }

  // save modal
  async function submitModal() {
    const name = form.name.trim();
    const priceNum = Number(form.price);
    if (!name || !Number.isFinite(priceNum) || priceNum <= 0) {
      push({ type:'error', message:'กรอกชื่อและราคาให้ถูกต้อง' });
      return;
    }
    setPendingOn(-1, true);
    try {
      if (editing) {
        // update
        const res = await fetch(`/api/products/${editing.id}`, {
          method:'PATCH', headers:{'content-type':'application/json'},
          body: JSON.stringify({ name, price: priceNum, active: form.active }),
        });
        const data = await res.json().catch(()=> ({}));
        if (!res.ok) throw new Error(data?.error || 'Update failed');
        push({ type:'success', message:'อัปเดตเมนูสำเร็จ' });
      } else {
        // create
        const res = await fetch('/api/products', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ name, price: priceNum }),
        });
        const data = await res.json().catch(()=> ({}));
        if (!res.ok) throw new Error(data?.error || 'Create failed');
        push({ type:'success', message:'เพิ่มเมนูสำเร็จ' });
      }
      await load();
      setModalOpen(false);
    } catch (e:any) {
      push({ type:'error', message: e?.message || 'Save failed' });
    } finally {
      setPendingOn(-1, false);
    }
  }

  // search + sort view
  const view = useMemo(() => {
    const f = products.filter(p => {
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return [p.id, p.name, p.price, p.active?'active':'inactive'].join(' ').toLowerCase().includes(s);
    });
    const sign = sortDir === 'asc' ? 1 : -1;
    f.sort((a,b) => {
      const va = sortKey==='name' ? a.name.toLowerCase() : sortKey==='price' ? a.price : sortKey==='active' ? Number(a.active??true) : a.id;
      const vb = sortKey==='name' ? b.name.toLowerCase() : sortKey==='price' ? b.price : sortKey==='active' ? Number(b.active??true) : b.id;
      if (va < vb) return -1 * sign;
      if (va > vb) return  1 * sign;
      return 0;
    });
    return f;
  }, [products, q, sortKey, sortDir]);

  function toggleSort(k: typeof sortKey) {
    setSortKey(k);
    setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
  }

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] p-6">
      <HeaderMenu />

      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-[var(--brand)]" />
            Manage Products
          </h1>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e)=> setQ(e.target.value)}
              placeholder="Search…"
              className="px-3 py-2 rounded-lg border bg-white w-56"
            />
            <button
              onClick={openAdd}
              className="px-3 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลดสินค้า…
          </div>
        ) : view.length === 0 ? (
          <div className="p-10 text-center text-gray-600">ไม่พบสินค้า</div>
        ) : (
          <div className="overflow-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left cursor-pointer" onClick={()=>toggleSort('id')}>ID</th>
                  <th className="px-3 py-2 text-left cursor-pointer" onClick={()=>toggleSort('name')}>Name</th>
                  <th className="px-3 py-2 text-right cursor-pointer" onClick={()=>toggleSort('price')}>Price</th>
                  <th className="px-3 py-2 text-center cursor-pointer" onClick={()=>toggleSort('active')}>Active</th>
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
                      <td className="px-3 py-2 text-right">{p.price.toLocaleString('en-US')}</td>
                      <td className="px-3 py-2 text-center">
                        <label className={`inline-flex items-center ${isPending ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox" className="sr-only peer"
                            checked={!!isActive} onChange={() => toggleActive(p)} disabled={isPending}
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
                          onClick={()=>openEdit(p)}
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

      {/* Modal Add/Edit */}
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Product' : 'Add Product'}
        onClose={()=> setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={()=> setModalOpen(false)} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 inline-flex items-center gap-1">
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
              value={form.name}
              onChange={(e)=> setForm(s=>({...s, name:e.target.value}))}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="เช่น Chocolate Chunk"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Price</label>
            <input
              value={form.price}
              onChange={(e)=> setForm(s=>({...s, price:e.target.value}))}
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
                onChange={(e)=> setForm(s=>({...s, active:e.target.checked}))}
              />
              <span>Active</span>
            </label>
          </div>
        </div>
      </Modal>
    </main>
  );
}
