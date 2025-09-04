// app/components/ui/Spinner.tsx
import { Loader2 } from 'lucide-react';
export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <Loader2 className="w-5 h-5 animate-spin" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}
