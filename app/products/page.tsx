'use client';

import { useEffect, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { Edit2, Save, X, Plus, Power, PowerOff, Package } from 'lucide-react';

/* ========== Types ========== */
type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  active: boolean;
};

export default function ProductsManagerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editActive, setEditActive] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('Cookies');

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
      const data = await res.json();
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { loadProducts(); }, []);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPrice(String(p.price));
    setEditCategory(p.category || '');
    setEditActive(p.active);
  };

  async function toggleStatus(p: Product) {
    try {
      await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      });
      await loadProducts();
    } catch (e) { alert("Toggle failed"); }
  }

  async function handleSaveEdit(id: number) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, price: Number(editPrice), category: editCategory, active: editActive }),
      });
      if (res.ok) { setEditingId(null); await loadProducts(); }
    } catch (e) { alert("Save failed"); } finally { setIsSubmitting(false); }
  }

  return (
    <main className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3"><HeaderMenu /></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black tracking-tight">MENU</h1>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-12 h-12 flex items-center justify-center bg-black text-white rounded-full shadow-lg active:scale-90 transition-transform"
          >
            {showAddForm ? <X /> : <Plus />}
          </button>
        </div>

        {/* ADD FORM - Optimized for Mobile Inputs */}
        {showAddForm && (
          <div className="bg-gray-50 rounded-3xl p-6 mb-8 border-2 border-dashed border-gray-200 space-y-4">
            <input 
              placeholder="Product Name" 
              className="w-full p-4 rounded-2xl border-0 bg-white text-base shadow-sm focus:ring-2 focus:ring-black outline-none"
              value={newName} onChange={e => setNewName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="number" placeholder="Price" 
                className="w-full p-4 rounded-2xl border-0 bg-white text-base shadow-sm focus:ring-2 focus:ring-black outline-none"
                value={newPrice} onChange={e => setNewPrice(e.target.value)}
              />
              <select 
                className="w-full p-4 rounded-2xl border-0 bg-white text-base shadow-sm focus:ring-2 focus:ring-black outline-none"
                value={newCategory} onChange={e => setNewCategory(e.target.value)}
              >
                <option value="Cookies">Cookies</option>
                <option value="Drinks">Drinks</option>
              </select>
            </div>
            <button 
              onClick={() => { /* add logic */ }}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              Add to Menu
            </button>
          </div>
        )}

        {/* PRODUCT LIST - Using Cards for better Mobile UX than a Table */}
        <div className="space-y-4">
          {products.map(p => {
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className={`p-4 rounded-3xl border-2 transition-all ${p.active ? 'border-gray-100 bg-white' : 'border-gray-50 bg-gray-50 opacity-60'}`}>
                {isEditing ? (
                  <div className="space-y-3">
                    <input 
                      value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full p-3 bg-gray-100 rounded-xl text-base font-bold outline-none border-2 border-black"
                    />
                    <div className="flex gap-2">
                      <input 
                        type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                        className="flex-1 p-3 bg-gray-100 rounded-xl text-base outline-none"
                      />
                      <button onClick={() => handleSaveEdit(p.id)} className="bg-black text-white px-6 rounded-xl font-bold">SAVE</button>
                      <button onClick={() => setEditingId(null)} className="bg-gray-200 p-3 rounded-xl"><X size={20}/></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleStatus(p)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${p.active ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}
                      >
                        <Power size={20} />
                      </button>
                      <div>
                        <h3 className="font-black text-lg leading-none uppercase">{p.name}</h3>
                        <p className="text-gray-400 text-sm font-bold mt-1">{p.price} ฿ • <span className="text-black/20">{p.category}</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => startEdit(p)}
                      className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-400 rounded-full active:bg-black active:text-white transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
