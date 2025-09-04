// app/components/ui/Button.tsx
'use client';
import { Loader2 } from 'lucide-react';
import { ComponentProps, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-40 disabled:pointer-events-none';
const sizes: Record<Size,string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};
const variants: Record<Variant,string> = {
  primary: 'bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90',
  secondary: 'bg-white border hover:bg-gray-50',
  ghost: 'hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-600/90',
};

type Props = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className='', variant='primary', size='md', loading=false, iconLeft, iconRight, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

export default Button;
