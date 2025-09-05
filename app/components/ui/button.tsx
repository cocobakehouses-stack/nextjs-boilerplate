'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  className?: string;
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition';
  const sizes: Record<Size, string> = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  const variants: Record<Variant, string> = {
    primary: 'bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90 disabled:opacity-40',
    secondary: 'bg-gray-900 text-white hover:opacity-90 disabled:opacity-40',
    outline: 'border bg-white hover:bg-gray-50 disabled:opacity-40',
    ghost: 'hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:opacity-90 disabled:opacity-40',
  };

  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
