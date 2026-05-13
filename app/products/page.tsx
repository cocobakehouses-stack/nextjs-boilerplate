'use client';

import { useEffect, useState } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { Edit2, Save, X, Plus, Power, Trash2 } from 'lucide-react';

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

  // --- NEW: Add Product Logic ---
  async function handleAddProduct() {
    if (!newName || !newPrice) return alert("Please fill in Name and Price");
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          price: Number(newPrice),
          category: newCategory,
          active: true
        }),
      });

      if (res.ok) {
        setNewName('');
        setNewPrice('');
        setShowAddForm(false);
        await loadProducts();
      } else {
        alert("Failed to add product");
      }
    } catch (e) {
      alert("Error connecting to server");
    } finally {
      setIsSubmitting(false);
    }
  }

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
        body: JSON.stringify({ 
          name: editName, 
          price: Number(editPrice), 
          category: editCategory, 
          active: editActive 
        }),
      });
      if (res.ok) { setEditingId(null); await loadProducts(); }
    } catch (e) { alert("Save failed"); } finally { setIsSubmitting(false); }
  }
      
  async function handleDelete(id: number) {
    if (!confirm("Are you SURE? This will permanently remove this product from the database.")) return;
    
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) await loadProducts();
      else alert("Delete failed");
    } catch (e) { alert("Error deleting"); }
  }

  return (
    <main className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3"><HeaderMenu /></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black tracking-tight uppercase italic">Menu Admin</h1>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-12 h-12 flex items-center justify-center bg-black text-white rounded-full shadow-lg active:scale-90 transition-transform"
          >
            {showAddForm ? <X /> : <Plus />}
          </button>
        </div>

        {/* ADD FORM */}
        {showAddForm && (
          <div className="bg-gray-50 rounded-3xl p-6 mb-8 border-2 border-black space-y-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <input 
              placeholder="Product Name" 
              className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-bold outline-none focus:border-black"
              value={newName} onChange={e => setNewName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="number" placeholder="Price" 
                className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-bold outline-none focus:border-black"
                value={newPrice} onChange={e => setNewPrice(e.target.value)}
              />
              <select 
                className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-white text-base font-bold outline-none focus:border-black"
                value={newCategory} onChange={e => setNewCategory(e.target.value)}
              >
                <option value="Cookies">Cookies</option>
                <option value="Drinks">Drinks</option>
                <option value="Packaging">Packaging</option>
              </select>
            </div>
            <button 
              disabled={isSubmitting}
              onClick={handleAddProduct}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Add to Menu'}
            </button>
          </div>
        )}

        {/* PRODUCT LIST */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center py-10 font-bold text-gray-400 italic">Loading Menu...</p>
          ) : products.map(p => {
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className={`p-4 rounded-3xl border-2 transition-all ${p.active ? 'border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                {isEditing ? (
                  <div className="space-y-3">
                    <input 
                      value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full p-3 bg-gray-100 rounded-xl text-base font-bold outline-none border-2 border-black"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                        className="p-3 bg-gray-100 rounded-xl text-base font-bold outline-none border-2 border-gray-200"
                      />
                      <input 
                        value={editCategory} onChange={e => setEditCategory(e.target.value)}
                        className="p-3 bg-gray-100 rounded-xl text-base font-bold outline-none border-2 border-gray-200"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(p.id)} className="flex-1 bg-black text-white py-3 rounded-xl font-bold uppercase tracking-tighter">Save</button>
                      <button onClick={() => handleDelete(p.id)} className="bg-red-100 text-red-600 px-4 rounded-xl"><Trash2 size={20}/></button>
                      <button onClick={() => setEditingId(null)} className="bg-gray-200 px-4 rounded-xl text-gray-600 font-bold">CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleStatus(p)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors border-2 ${p.active ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-100 border-gray-300 text-gray-400'}`}
                      >
                        <Power size={20} />
                      </button>
                      <div>
                        <h3 className="font-black text-lg leading-none uppercase italic">{p.name}</h3>
                        <p className="text-gray-500 text-sm font-bold mt-1">{p.price} ฿ • <span className="text-black/30 italic">{p.category}</span></p>
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
