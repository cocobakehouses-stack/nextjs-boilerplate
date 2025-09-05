// app/components/ui/Card.tsx
'use client';
import { cn } from "./utils";

export function Card({className='', ...p}:React.HTMLAttributes<HTMLDivElement>){
  return <div className={cn('card p-4', className)} {...p} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
export function CardHeader({title,desc}:{title:string;desc?:string}){
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc ? <p className="text-sm text-[var(--text-muted)]">{desc}</p> : null}
    </div>
  );
}
