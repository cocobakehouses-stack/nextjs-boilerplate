// app/components/ui/VisuallyHidden.tsx
import { ComponentProps } from 'react';
export default function VisuallyHidden(props: ComponentProps<'span'>) {
  return (
    <span
      {...props}
      className="sr-only"
    />
  );
}
