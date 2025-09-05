// app/components/ui/DataTable.tsx
'use client';

import type { ReactNode } from 'react';

// mini classnames helper (กัน error และใช้ง่าย)
function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-white', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
