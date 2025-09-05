'use client';
import { cn } from '@/app/lib/ui';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary'|'ghost'|'danger';
  loading?: boolean;
};
export default function Button({variant='primary', loading, className, children, ...rest}:Props){
  return (
    <button
      className={cn('btn', variant==='primary'&&'btn-primary', variant==='ghost'&&'btn-ghost', variant==='danger'&&'btn-danger', loading&&'opacity-60 pointer-events-none', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
