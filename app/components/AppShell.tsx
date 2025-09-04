// app/components/AppShell.tsx
'use client';

type Props = {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode; // ปุ่มด้านขวา
  children: React.ReactNode;
};

export default function AppShell({ title, subtitle, actions, children }: Props) {
  return (
    <section className="space-y-4">
      {(title || actions || subtitle) && (
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            {title && <h1 className="text-2xl font-bold">{title}</h1>}
            {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          {actions ? <div className="flex gap-2">{actions}</div> : null}
        </header>
      )}
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
