"use client";

import { useState } from "react";
import { products } from "../data/products"; // ดึงข้อมูลสินค้ามาจากไฟล์ data/products.ts

// กำหนด type ของสินค้าและตะกร้า
type Product = { id: number; name: string; price: number };
type CartItem = Product & { quantity: number };

export default function Home() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addedItems, setAddedItems] = useState<Record<number, boolean>>({});

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }

    setAddedItems({ ...addedItems, [product.id]: true });

    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [product.id]: false }));
    }, 1000);
  };

  const updateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(id);
    } else {
      setCart(
        cart.map((item) =>
          item.id === id ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const totalPrice = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Coco Bakehouse</h1>

      {/* สินค้า */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="border rounded-lg p-4 flex flex-col items-center"
          >
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p className="text-gray-600">{product.price} THB</p>
            <button
              onClick={() => addToCart(product)}
              className={`mt-2 px-4 py-2 rounded text-white ${
                addedItems[product.id] ? "bg-green-500" : "bg-blue-500"
              }`}
            >
              {addedItems[product.id] ? "Added!" : "Add to Cart"}
            </button>
          </div>
        ))}
      </div>

      {/* ตะกร้าสินค้า */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Cart</h2>
        {cart.length === 0 ? (
          <p>Cart is empty</p>
        ) : (
          <div className="space-y-4">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center border-b pb-2"
              >
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p>
                    {item.price} THB x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="px-2 py-1 border rounded"
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="px-2 py-1 border rounded"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="text-right font-bold">
              Total: {totalPrice} THB
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
