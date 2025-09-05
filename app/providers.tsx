'use client';

import React from 'react';
import { ToastProvider, ToastViewport } from './components/Toast';
// ถ้าของคุณไม่มี ToastViewport ให้เปลี่ยนเป็น <Toaster /> หรือคอมโพเนนต์ที่ lib ของคุณมี

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}
