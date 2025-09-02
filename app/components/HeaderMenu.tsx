'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CreditCard,
  Package,
  FileText,
  Clock,
} from 'lucide-react';

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export default function HeaderMenu() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/pos', label: 'POS', icon: CreditCard },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/reports', label: 'Reports', icon: FileText },
    { href: '/history', label: 'History', icon: Clock },
  ];

  return (
    <div className="mb-4 flex items-center gap-3 bg-white/80 backdrop-blur px-4 py-2 rounded-xl border">
      {links.map((l) => {
        const Icon = l.icon;
        const isActive = pathname === l.href;

        return (
          <Link
            key={l.href}
            href={l.href}
            className={classNames(
              'flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-all',
              isActive
                ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-sm'
                : 'hover:bg-gray-100 text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
