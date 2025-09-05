import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';
import HeaderMenu from './components/HeaderMenu';

export const metadata: Metadata = {
  title: 'Coco Bakehouse Dashboard',
  description: 'Internal POS & reports',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[var(--surface-muted)] text-[var(--text)] antialiased">
        <Providers>
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

          {/* Global footer */}
          <footer className="border-t bg-white/70">
            <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-500">
              Coco Bakehouse • Internal tool
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
