'use client';

import { useEffect, useState, useMemo } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { Edit2, Save, X, Trash2, Plus, Power, PowerOff } from 'lucide-react';

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

  // --- Edit States ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editActive, setEditActive] = useState(true);

  // --- Add New Product States ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('Cookies');

  /* ========== Data Fetching ========== */
  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/products?activeOnly=0', { cache: 'no-store' });
      const data = await res.json();
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (e) {
      console.error("Failed to load products", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  /* ========== Actions ========== */
  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPrice(String(p.price));
    setEditCategory(p.category || '');
    setEditActive(p.active);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

async function handleSaveEdit(id: number) {
  if (!editName || !editPrice) return alert("Please fill Name and Price");
  setIsSubmitting(true);
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName,
        price: Number(editPrice),
        category: editCategory,
        active: editActive,
      }),
    });

    if (res.ok) {
      setEditingId(null);
      await loadProducts();
    } else {
      alert("Failed to save changes");
    }
  } catch (e) {
    alert("Error updating product");
  } finally {
    setIsSubmitting(false);
  }
}

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
      alert("Error adding product");
    } finally {
      setIsSubmitting(false);
    }
  }

async function toggleStatus(p: Product) {
  try {
    const res = await fetch(`/api/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    });
    if (res.ok) await loadProducts();
  } catch (e) {
    alert("Failed to toggle status");

  /* ========== Render ========== */
  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <HeaderMenu />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAddForm ? <X size={18} /> : <Plus size={18} />}
            {showAddForm ? 'Cancel' : 'Add New Product'}
          </button>
        </div>

        {/* ADD PRODUCT FORM */}
        {showAddForm && (
          <div className="bg-white border-2 border-blue-100 rounded-xl p-6 mb-8 shadow-sm animate-in fade-in slide-in-from-top-4">
            <h2 className="font-semibold mb-4 text-blue-800">New Product Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <input
                placeholder="Product Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border rounded-lg px-3 py-2 outline-blue-500"
              />
              <input
                type="number"
                placeholder="Price (THB)"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="border rounded-lg px-3 py-2 outline-blue-500"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="border rounded-lg px-3 py-2 outline-blue-500 bg-white"
              >
                <option value="Cookies">Cookies</option>
                <option value="Cakes">Cakes</option>
                <option value="Drinks">Drinks</option>
                <option value="Others">Others</option>
              </select>
              <button
                onClick={handleAddProduct}
                disabled={isSubmitting}
                className="bg-blue-600 text-white rounded-lg py-2 font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Create Product'}
              </button>
            </div>
          </div>
        )}

        {/* PRODUCTS TABLE */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-20 text-gray-400">Loading inventory...</td></tr>
              ) : (
                products.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className={`${!p.active ? 'bg-gray-50' : ''} hover:bg-gray-50/50 transition-colors`}>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleStatus(p)} className="focus:outline-none">
                          {p.active ? (
                            <span className="flex items-center gap-1 text-green-600 font-bold">
                              <Power size={14} /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-400 font-bold">
                              <PowerOff size={14} /> Hidden
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {isEditing ? (
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border rounded px-2 py-1 w-full"
                          />
                        ) : (
                          <span className={!p.active ? 'text-gray-400' : 'text-gray-900'}>{p.name}</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-gray-500">
                        {isEditing ? (
                          <input
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="border rounded px-2 py-1 w-full"
                          />
                        ) : (
                          p.category
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="border rounded px-2 py-1 w-40"
                          />
                        ) : (
                          <span className="font-bold">{p.price.toFixed(2)} ฿</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSaveEdit(p.id)}
                              disabled={isSubmitting}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
