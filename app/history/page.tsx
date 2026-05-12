'use client';

import { useEffect, useState, useMemo } from 'react';
import HeaderMenu from '../components/HeaderMenu';
import { Calendar, Download, Package, Gift, ChevronRight, Search, Clock, MapPin } from 'lucide-react';

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

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/orders?limit=100', { cache: 'no-store' });
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  // Filter logic
  const filteredOrders = useMemo(() => {
  return orders.filter(o => {
    // Check if o, o.billNo, and o.location actually exist before using them
    const billNo = o?.billNo || ""; 
    const location = o?.location || "";
    
    return (
      billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
}, [orders, searchTerm]);
  
  // FREEBIE SUMMARY LOGIC
  const freebieSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    filteredOrders.forEach(order => {
      order.freebies?.forEach(f => {
        summary[f.name] = (summary[f.name] || 0) + f.qty;
      });
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [filteredOrders]);

  return (
    <main className="min-h-screen bg-[#fffff0] pb-20">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b-4 border-black">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <HeaderMenu />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Sales History</h1>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Tracking & Freebie Logs</p>
        </header>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search Bill No or Location..." 
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-black font-bold outline-none shadow-[4px_4px_0px_rgba(0,0,0,1)] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* FREEBIE SUMMARY SECTION */}
        {freebieSummary.length > 0 && (
          <section className="bg-orange-50 border-2 border-orange-200 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="text-orange-600" size={20} />
              <h2 className="font-black uppercase text-sm tracking-tight text-orange-900">Freebie Summary (Current View)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {freebieSummary.map(([name, qty]) => (
                <div key={name} className="bg-white border border-orange-100 p-3 rounded-xl flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-gray-500 truncate mr-2">{name}</span>
                  <span className="text-orange-600 font-black text-sm">x{qty}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ORDERS FEED */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-20 font-bold text-gray-400 animate-pulse">Loading Logs...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-20 text-gray-300 font-bold italic">No orders found</div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.billNo} className="bg-white border-2 border-black rounded-3xl overflow-hidden shadow-sm">
                {/* Card Header */}
                <div className="bg-gray-50 border-b-2 border-black px-5 py-3 flex justify-between items-center">
                  <span className="font-black text-xs tracking-tighter uppercase">#{order.billNo}</span>
                  <span className="bg-black text-white text-[10px] font-black px-2 py-1 rounded uppercase">
                    {order.payment}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-gray-500 font-bold text-[10px] uppercase">
                        <MapPin size={12} /> {order.location}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 text-[10px] font-medium uppercase">
                        <Clock size={12} /> {order.date} • {order.time}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#ac0000] leading-none">{order.total.toFixed(2)} ฿</p>
                    </div>
                  </div>

                  {/* Items list - simplified for phone */}
                  <div className="bg-[#fffff0]/50 rounded-2xl p-3 space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-bold">
                        <span className="text-gray-700">{item.name} <span className="text-gray-400 ml-1">x{item.qty}</span></span>
                        <span className="font-mono">{(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                    {order.freebies && order.freebies.map((f, idx) => (
                      <div key={`free-${idx}`} className="flex justify-between text-xs font-black text-orange-600">
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
