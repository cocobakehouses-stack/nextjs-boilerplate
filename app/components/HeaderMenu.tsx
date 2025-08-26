'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export default function HeaderMenu() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/pos', label: 'POS' },
    { href: '/products', label: 'Products' },
    { href: '/reports', label: 'Reports' },
    { href: '/history', label: 'History' },
  ];

  return (
    <div className="mb-4 flex items-center gap-3 bg-white/80 backdrop-blur px-4 py-2 rounded-xl border">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={classNames(
            'px-3 py-1 rounded-lg text-sm font-medium',
            pathname === l.href
              ? 'bg-[#ac0000] text-[#fffff0]'
              : 'hover:bg-gray-100'
          )}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
