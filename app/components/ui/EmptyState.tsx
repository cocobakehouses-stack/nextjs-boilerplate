// app/components/ui/EmptyState.tsx
import Button from './Button';

export default function EmptyState({
  icon,
  title='ยังไม่มีข้อมูล',
  description='เริ่มสร้างรายการแรกของคุณได้เลย',
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="text-center py-14">
      <div className="mx-auto mb-4 h-14 w-14 rounded-full grid place-items-center bg-gray-100 text-gray-600">
        {icon ?? '🗂️'}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
