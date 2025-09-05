'use client';

import { ToastProvider, ToastViewport } from './components/Toast'; // ชื่อ export อาจต่างจากโปรเจกต์คุณ ถ้าไฟล์คุณ export เป็นชื่ออื่น ให้ปรับตามนั้น
import React from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      {/* ถ้ามี viewport/container ของระบบ toast ให้ใส่ด้วย */}
      <ToastViewport />
    </ToastProvider>
  );
}
