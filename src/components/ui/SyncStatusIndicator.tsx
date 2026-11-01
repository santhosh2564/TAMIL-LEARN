import { CheckCircle2, CloudUpload, HardDrive } from 'lucide-react';

export interface SyncStatusIndicatorProps {
  studentId?: string;
  pendingCount?: number;
  isOnline?: boolean;
  className?: string;
}

export function SyncStatusIndicator({
  pendingCount = 0,
  isOnline = true,
  className = '',
}: SyncStatusIndicatorProps) {
  if (pendingCount > 0 && isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${className}`}
        role="status"
        aria-live="polite"
      >
        <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
        <span>Saving... / சேமிக்கப்படுகிறது</span>
      </div>
    );
  }

  if (pendingCount > 0 && !isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
        role="status"
        aria-live="polite"
      >
        <HardDrive className="w-3.5 h-3.5" />
        <span>Saved to this computer / கணினியில் சேமிக்கப்பட்டது</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
      <span>Saved / சேமிக்கப்பட்டது</span>
    </div>
  );
}
