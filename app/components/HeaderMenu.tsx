'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
// 🆕 Lucide icons
import { Home, ShoppingCart, Package, BarChart3, Clock } from 'lucide-react';

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export default function HeaderMenu() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/pos', label: 'POS', icon: ShoppingCart },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/history', label: 'History', icon: Clock },
  ];

  return (
    <nav className="mb-6 flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl border shadow-sm">
      {links.map((l) => {
        const Icon = l.icon;
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              active
                ? 'bg-[#ac0000] text-[#fffff0]'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="w-4 h-4" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
