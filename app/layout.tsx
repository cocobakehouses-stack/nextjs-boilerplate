// app/layout.tsx
import './global.css';
import type { Metadata } from 'next';
import HeaderMenu from './components/HeaderMenu';

export const metadata: Metadata = {
  title: 'Coco Bakehouse POS',
  description: 'Internal POS & reports',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[var(--surface-muted)] text-[var(--text)] antialiased">
        {/* Global Sticky Header */}
        <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <HeaderMenu />
          </div>
        </header>

        {/* Page container */}
        <main className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>

        {/* Global footer (ปรับข้อความตามต้องการ) */}
        <footer className="border-t bg-white/70">
          <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-500">
            Coco Bakehouse • Internal tool
          </div>
        </footer>
      </body>
    </html>
  );
}
