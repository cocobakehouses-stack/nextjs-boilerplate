'use client';

import React from 'react';
import { ToastProvider } from './components/Toast'; // ใช้แค่นี้พอ

export default function Providers({ children }: { children: React.ReactNode }) {
  // ถ้า lib ของคุณมี <Toaster /> หรืออะไรที่ต้องวาง global UI,
  // สามารถนำมาใส่ใต้ ToastProvider ได้เลย
  return <ToastProvider>{children}</ToastProvider>;
}
