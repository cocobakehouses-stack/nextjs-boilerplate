// app/components/HeaderMenu.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CreditCard, Package, FileText, Clock } from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function HeaderMenu() {
  const pathname = usePathname() || '/';

  // brand
  const Brand = (
    <Link
      href="/"
      aria-label="Home"
      className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[var(--brand)] hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
    >
      <Home className="h-5 w-5" />
      <span className="text-base font-bold">Coco Bakehouse</span>
    </Link>
  );

  const links = [
    { href: '/pos', label: 'POS', icon: CreditCard },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/reports', label: 'Reports', icon: FileText },
    { href: '/history', label: 'History', icon: Clock },
  ] as const;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="mb-4 rounded-xl border bg-white/80 px-4 py-2 backdrop-blur">
      <div className="mx-auto max-w-6xl flex flex-col gap-2">
        {/* แถวแรก: Brand */}
        <div className="flex items-center">{Brand}</div>

        {/* แถวสอง: Links */}
        <nav
          aria-label="Main"
          className="flex flex-wrap gap-2"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                  active
                    ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
