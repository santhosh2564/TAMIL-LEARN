import { Button } from '../../../components/ui/Button';
import { ReactNode } from 'react';

interface ActivitySubmitAreaProps {
  onCheck: () => void;
  onNext: () => void;
  canCheck: boolean;
  status: 'idle' | 'active' | 'completed';
  feedback?: ReactNode;
  onRetry?: () => void;
  showRetry?: boolean;
  checkLabel?: string;
  continueLabel?: string;
  retryLabel?: string;
}

export function ActivitySubmitArea({
  onCheck,
  onNext,
  canCheck,
  status,
  feedback,
  onRetry,
  showRetry,
  checkLabel = 'விடையைச் சரிபார்',
  continueLabel = 'தொடர்க',
  retryLabel = 'மீண்டும் முயற்சி செய்',
}: ActivitySubmitAreaProps) {
  const isCompleted = status === 'completed';

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* ── Primary action ──────────────────────────────────────────────── */}
      <div className="w-full flex justify-end">
        {isCompleted ? (
          <Button onClick={onNext} className="w-full sm:w-auto">
            {continueLabel}
          </Button>
        ) : (
          <Button
            onClick={onCheck}
            disabled={!canCheck}
            className="w-full sm:w-auto"
          >
            {checkLabel}
          </Button>
        )}
      </div>

      {/* ── Feedback banner (correct / wrong) ───────────────────────────── */}
      {feedback}

      {/* ── Separate retry control — only after a wrong submission ─────── */}
      {showRetry && onRetry && (
        <div className="w-full flex justify-end">
          <Button
            onClick={onRetry}
            variant="secondary"
            autoFocus
            aria-label={retryLabel}
            className="w-full sm:w-auto"
          >
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
