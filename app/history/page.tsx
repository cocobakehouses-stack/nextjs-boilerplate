'use client';

import { useEffect, useState, useMemo } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { 
  Calendar, Trash2, Gift, Search, Clock, 
  MapPin, Filter, AlertCircle, CheckCircle2 
} from 'lucide-react';

type Order = {
  billNo: string;
  date: string;
  time: string;
  location: string;
  payment: string;
  total: number;
  items: { name: string; qty: number; price: number }[];
  freebies: { name: string; qty: number }[];
};

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoc, setSelectedLoc] = useState<string>('ALL');

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=200', { cache: 'no-store' });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error("Fetch failed", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHistory(); }, []);

  // 1. Get unique locations for the filter
  const locations = useMemo(() => {
    const locs = new Set(orders.map(o => o.location).filter(Boolean));
    return ['ALL', ...Array.from(locs).sort()];
  }, [orders]);

  // 2. Filter logic (Defensive against undefined)
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchLoc = selectedLoc === 'ALL' || o.location === selectedLoc;
      const matchSearch = (o.billNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (o.location || "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchLoc && matchSearch;
    });
  }, [orders, searchTerm, selectedLoc]);

  // 3. Void Logic
  async function voidBill(order: Order) {
    const confirmVoid = confirm(`VOID BILL #${order.billNo}?\nThis will remove it from the records.`);
    if (!confirmVoid) return;

    try {
      // We use the same DELETE endpoint, passing location as a query or body 
      // if your API needs to know which tab to look in.
      const res = await fetch(`/api/orders/${order.billNo}?location=${order.location}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        alert("Bill Voided Successfully");
        fetchHistory(); // Refresh list
      } else {
        alert("Failed to void bill. Check API.");
      }
    } catch (e) {
      alert("Error connecting to server.");
    }
  }

  // 4. Freebie Tally
  const freebieSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    filteredOrders.forEach(order => {
      order.freebies?.forEach(f => {
        summary[f.name] = (summary[f.name] || 0) + (Number(f.qty) || 0);
      });
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [filteredOrders]);

  return (
    <main className="min-h-screen bg-[#fffff0] pb-20">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b-4 border-black px-4 py-4">
        <HeaderMenu />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">History</h1>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Location: {selectedLoc}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-black">{filteredOrders.length}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Orders</p>
          </div>
        </header>

        {/* Location Selection Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {locations.map(loc => (
            <button
              key={loc}
              onClick={() => setSelectedLoc(loc)}
              className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest border-2 transition-all whitespace-nowrap
                ${selectedLoc === loc ? 'bg-black border-black text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search Bill No..." 
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-black font-bold outline-none shadow-[4px_4px_0px_rgba(0,0,0,1)]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Freebie Summary */}
        {freebieSummary.length > 0 && (
          <section className="bg-orange-50 border-2 border-orange-200 rounded-3xl p-6">
            <h2 className="font-black uppercase text-sm tracking-tight text-orange-900 mb-4 flex items-center gap-2">
              <Gift size={18} /> Freebie Tally
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {freebieSummary.map(([name, qty]) => (
                <div key={name} className="bg-white border border-orange-100 p-3 rounded-xl flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-gray-500 truncate mr-1">{name}</span>
                  <span className="text-orange-600 font-black text-sm">x{qty}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Orders Feed */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center py-10 font-bold text-gray-400">Syncing with Sheets...</p>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.billNo} className="bg-white border-2 border-black rounded-3xl overflow-hidden">
                <div className="bg-gray-50 border-b-2 border-black px-5 py-3 flex justify-between items-center">
                  <span className="font-black text-xs uppercase">#{order.billNo}</span>
                  <button 
                    onClick={() => voidBill(order)}
                    className="text-gray-300 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-gray-500 font-bold text-[10px] uppercase">
                        <MapPin size={12} /> {order.location}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 text-[10px] font-medium uppercase">
                        <Clock size={12} /> {order.time} • {order.payment}
                      </div>
                    </div>
                    <p className="text-2xl font-black text-[#ac0000]">{order.total.toFixed(2)} ฿</p>
                  </div>

                  <div className="bg-[#fffff0]/50 rounded-2xl p-4 space-y-2 border border-gray-100">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-bold">
                        <span className="text-gray-700">{item.name} <span className="text-gray-400 ml-1 text-[10px]">x{item.qty}</span></span>
                        <span>{(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                    {order.freebies.map((f, idx) => (
                      <div key={`f-${idx}`} className="flex justify-between text-xs font-black text-orange-600">
                        <span>{f.name} <span className="opacity-60 ml-1">x{f.qty}</span></span>
                        <span>FREE</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
