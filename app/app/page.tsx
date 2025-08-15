'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, Trash2, CreditCard, History, Download, Calendar, Check } from 'lucide-react';

const CookieShopPOS = () => {
  // Cookie products sorted by price (most expensive to least expensive)
  const [products] = useState([
    { id: 1, name: 'Matcha Macadamia', price: 169 },
    { id: 2, name: 'Croissant Cookie', price: 159 },
    { id: 3, name: 'Pistachio Dark Choc', price: 159 },
    { id: 4, name: 'New York Signature', price: 135 },
    { id: 5, name: 'Hazelnut Choc Chip', price: 135 },
    { id: 6, name: 'Dark Choc 70%', price: 135 },
    { id: 7, name: 'Dark Cranberry', price: 135 },
    { id: 8, name: 'Dark Orange', price: 135 },
    { id: 9, name: 'Biscoff', price: 135 },
    { id: 10, name: 'Peanut Butter', price: 135 },
    { id: 11, name: 'DOUBLE Choc', price: 135 },
    { id: 12, name: 'White Chocolate & Dark Choc', price: 135 },
    { id: 13, name: 'Choc Chip', price: 129 },
    { id: 14, name: 'Walnut', price: 129 },
    { id: 15, name: 'Red Velvet', price: 125 },
    { id: 16, name: 'Lemon', price: 125 },
    { id: 17, name: "S'more", price: 109 },
    { id: 18, name: 'Salt Caramel', price: 109 }
  ]);

  const [cart, setCart] = useState([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [addedItems, setAddedItems] = useState({});

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    
    // Show "Added!" animation
    setAddedItems(prev => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItems(prev => ({ ...prev, [product.id]: false }));
    }, 1000);
  };

  const updateQuantity = (id, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(id);
    } else {
      setCart(cart.map(item => 
        item.id === id ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getTotal = () => {
    return getSubtotal(); // No tax, so total equals subtotal
  };

  const startPaymentProcess = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const selectPaymentMethod = (method) => {
    setSelectedPaymentMethod(method);
  };

  const clearCart = () => {
    setCart([]);
  };

  const confirmPayment = () => {
    const transaction = {
      id: Date.now(),
      items: [...cart],
      subtotal: getSubtotal(),
      total: getTotal(),
      paymentMethod: selectedPaymentMethod,
      timestamp: new Date().toLocaleString(),
      date: new Date().toLocaleDateString()
    };
    
    setLastTransaction(transaction);
    const updatedHistory = [...transactionHistory, transaction];
    setTransactionHistory(updatedHistory);
    setCart([]);
    setShowPaymentModal(false);
    setSelectedPaymentMethod(null);
    setShowReceipt(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPaymentMethod(null);
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setLastTransaction(null);
  };

  const getTodaysTransactions = () => {
    const today = new Date().toLocaleDateString();
    return transactionHistory.filter(t => t.date === today);
  };

  const getTodaysSummary = () => {
    const todaysTransactions = getTodaysTransactions();
    const totalSales = todaysTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalItems = todaysTransactions.reduce((sum, t) => 
      sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    
    return {
      transactionCount: todaysTransactions.length,
      totalSales,
      totalItems,
      transactions: todaysTransactions
    };
  };

  const exportToCSV = () => {
    const summary = getTodaysSummary();
    let csv = "Date,Time,Items,Total\n";
    
    summary.transactions.forEach(transaction => {
      const itemsText = transaction.items.map(item => 
        `${item.name} x${item.quantity}`).join('; ');
      csv += `${transaction.date},"${transaction.timestamp}","${itemsText}",${transaction.total.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookie-shop-sales-${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearAllHistory = () => {
    if (window.confirm('Are you sure you want to clear ALL transaction history? This cannot be undone.')) {
      setTransactionHistory([]);
    }
  };

  const exportEndOfDay = () => {
    const today = new Date().toLocaleDateString();
    const todaysTransactions = transactionHistory.filter(t => t.date === today);
    
    if (todaysTransactions.length === 0) {
      alert('No transactions today to export.');
      return;
    }
    
    let csv = "Cookie Shop - End of Day Report\n";
    csv += `Date: ${today}\n\n`;
    
    // Summary
    const totalSales = todaysTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalItems = todaysTransactions.reduce((sum, t) => 
      sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    
    csv += "DAILY SUMMARY\n";
    csv += `Total Transactions: ${todaysTransactions.length}\n`;
    csv += `Total Items Sold: ${totalItems}\n`;
    csv += `Gross Sales: ${totalSales.toFixed(2)}\n\n`;
    
    // Transaction details
    csv += "TRANSACTION DETAILS\n";
    csv += "Time,Items,Total\n";
    
    todaysTransactions.forEach(transaction => {
      const itemsText = transaction.items.map(item => 
        `${item.name} x${item.quantity}`).join('; ');
      const time = transaction.timestamp.split(', ')[1] || transaction.timestamp;
      csv += `"${time}","${itemsText}",${transaction.total.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookie-shop-end-of-day-${today.replace(/\//g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen" style={{backgroundColor: '#fffff0'}}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold" style={{color: '#ac0000'}}>🍪 Cookie Shop POS</h1>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          style={{backgroundColor: '#ac0000'}}
          onMouseOver={(e) => e.target.style.backgroundColor = '#8b0000'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#ac0000'}
        >
          <History size={20} /> {showHistory ? 'Hide' : 'Show'} History
        </button>
      </div>
      
      {/* Transaction History Panel */}
      {showHistory && (
        <div className="mb-6 bg-white p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              <Calendar size={24} /> Today's Sales Summary
            </h2>
            <div className="flex gap-2">
              <button
                onClick={exportEndOfDay}
                className="text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                style={{backgroundColor: '#ac0000'}}
                onMouseOver={(e) => e.target.style.backgroundColor = '#8b0000'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#ac0000'}
                disabled={getTodaysTransactions().length === 0}
              >
                <Download size={18} /> End-of-Day Report
              </button>
              <button
                onClick={exportToCSV}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                disabled={getTodaysTransactions().length === 0}
              >
                <Download size={18} /> Export CSV
              </button>
              <button
                onClick={clearAllHistory}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Clear History
              </button>
            </div>
          </div>

          {(() => {
            const summary = getTodaysSummary();
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <h3 className="text-lg font-semibold text-blue-800">Transactions</h3>
                    <p className="text-2xl font-bold text-blue-600">{summary.transactionCount}</p>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{backgroundColor: '#ffeaea'}}>
                    <h3 className="text-lg font-semibold" style={{color: '#ac0000'}}>Total Sales</h3>
                    <p className="text-2xl font-bold" style={{color: '#ac0000'}}>฿{summary.totalSales.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <h3 className="text-lg font-semibold text-purple-800">Items Sold</h3>
                    <p className="text-2xl font-bold text-purple-600">{summary.totalItems}</p>
                  </div>
                </div>

                {summary.transactions.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto">
                    <h3 className="font-semibold mb-3">Transaction Details:</h3>
                    <div className="space-y-2">
                      {summary.transactions.map(transaction => (
                        <div key={transaction.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm text-gray-600">{transaction.timestamp}</p>
                              <div className="mt-1">
                                {transaction.items.map((item, idx) => (
                                  <span key={idx} className="text-sm mr-3">
                                    {item.name} x{item.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold" style={{color: '#ac0000'}}>฿{transaction.total.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No transactions today</p>
                )}
              </>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(product => (
              <div key={product.id} className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow relative">
                <h3 className="font-semibold text-lg text-gray-800">{product.name}</h3>
                <p className="text-xl font-bold mt-2" style={{color: '#ac0000'}}>฿{product.price}</p>
                <button
                  onClick={() => addToCart(product)}
                  className="mt-3 w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  style={{backgroundColor: '#ac0000'}}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#8b0000'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#ac0000'}
                >
                  <Plus size={18} /> Add to Cart
                </button>
                {addedItems[product.id] && (
                  <div className="absolute top-2 right-2 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 animate-bounce"
                       style={{backgroundColor: '#ac0000'}}>
                    <Check size={16} /> Added!
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cart Section */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={24} />
            <h2 className="text-2xl font-semibold text-gray-800">Cart</h2>
          </div>

          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Cart is empty</p>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.name}</h4>
                      <p className="font-semibold" style={{color: '#ac0000'}}>฿{item.price} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-xl font-bold">
                  <span>Total:</span>
                  <span style={{color: '#ac0000'}}>฿{getTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={startPaymentProcess}
                  className="w-full text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  style={{backgroundColor: '#ac0000'}}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#8b0000'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#ac0000'}
                >
                  <CreditCard size={20} /> Process Payment
                </button>
                <button
                  onClick={clearCart}
                  className="w-full bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-center mb-6" style={{color: '#ac0000'}}>Choose Payment Method</h3>
            
            <div className="text-center mb-6">
              <p className="text-lg">Total Amount:</p>
              <p className="text-3xl font-bold" style={{color: '#ac0000'}}>฿{getTotal().toFixed(2)}</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => selectPaymentMethod('cash')}
                className="w-full p-4 border-2 rounded-lg hover:bg-gray-50 transition-colors"
                style={{borderColor: selectedPaymentMethod === 'cash' ? '#ac0000' : '#ddd'}}
              >
                <div className="text-lg font-semibold">💵 Cash</div>
              </button>

              <button
                onClick={() => selectPaymentMethod('krungsri')}
                className="w-full p-4 border-2 rounded-lg hover:bg-gray-50 transition-colors"
                style={{borderColor: selectedPaymentMethod === 'krungsri' ? '#ac0000' : '#ddd'}}
              >
                <div className="text-lg font-semibold">📱 Krungsri PromptPay</div>
                <div className="text-sm text-gray-600">064-243-8393</div>
              </button>

              <button
                onClick={() => selectPaymentMethod('kbank')}
                className="w-full p-4 border-2 rounded-lg hover:bg-gray-50 transition-colors"
                style={{borderColor: selectedPaymentMethod === 'kbank' ? '#ac0000' : '#ddd'}}
              >
                <div className="text-lg font-semibold">🏦 K-Bank PromptPay</div>
                <div className="text-sm text-gray-600">xxx-x-x1777-x</div>
              </button>
            </div>

            {selectedPaymentMethod && selectedPaymentMethod !== 'cash' && (
              <div className="mt-6 text-center">
                <p className="mb-4 font-semibold">Scan QR Code to Pay:</p>
                <div className="flex justify-center mb-4">
                  {selectedPaymentMethod === 'krungsri' ? (
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <p className="text-sm mb-2">Show this QR code to customer:</p>
                      <div className="text-xs text-gray-600 mb-2">
                        Krungsri PromptPay: 064-243-8393<br/>
                        THITIRAT HENGSAKUL
                      </div>
                      <div className="text-center text-gray-500 py-8 border-2 border-dashed rounded">
                        [Krungsri QR Code would display here]
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <p className="text-sm mb-2">Show this QR code to customer:</p>
                      <div className="text-xs text-gray-600 mb-2">
                        K-Bank PromptPay: xxx-x-x1777-x<br/>
                        THITIRAT HENGSAKUL
                      </div>
                      <div className="text-center text-gray-500 py-8 border-2 border-dashed rounded">
                        [K-Bank QR Code would display here]
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-center mt-4 text-gray-600">
                  Customer scans QR code and pays ฿{getTotal().toFixed(2)}
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={closePaymentModal}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {selectedPaymentMethod && (
                <button
                  onClick={confirmPayment}
                  className="flex-1 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  style={{backgroundColor: '#ac0000'}}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#8b0000'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#ac0000'}
                >
                  {selectedPaymentMethod === 'cash' ? 'Complete Cash Payment' : 'Payment Received'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-center mb-4 text-green-600">Payment Complete!</h3>
            
            <div className="text-center mb-4">
              <h4 className="font-bold">🍪 Cookie Shop Receipt</h4>
              <p className="text-sm text-gray-600">{lastTransaction.timestamp}</p>
            </div>

            <div className="space-y-2 mb-4 text-sm">
              {lastTransaction.items.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span>{item.name} x{item.quantity}</span>
                  <span>฿{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>฿{lastTransaction.total.toFixed(2)}</span>
              </div>
              <div className="text-center text-xs text-gray-600 mt-2">
                Payment Method: {lastTransaction.paymentMethod}
              </div>
            </div>

            <button
              onClick={closeReceipt}
              className="w-full mt-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              New Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CookieShopPOS;
