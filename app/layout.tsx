// app/layout.tsx
import "./global.css";
import type { Metadata } from "next";
import HeaderMenu from "./components/HeaderMenu";

export const metadata: Metadata = {
  title: "Coco Bakehouse",
  description: "POS & Reports",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--surface-muted)] text-[var(--text)]">
        {/* Top nav (sticky) */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <HeaderMenu />
          </div>
        </div>

        {/* Page container */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
