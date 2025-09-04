// app/components/ui/Button.tsx
'use client';
import { ButtonHTMLAttributes } from "react";
import { cn } from "../utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

export default function Button({ className, variant="primary", loading, children, ...rest }: Props) {
  const variants = {
    primary: "bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90",
    secondary: "bg-white border hover:bg-gray-50",
    ghost: "hover:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  } as const;

  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...rest}
    >
      {loading ? "Loading…" : children}
    </button>
  );
}
