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
}

/**
 * Primary action area rendered below every activity variant.
 *
 * Layout (top → bottom):
 *   1. Primary action — always visible:
 *        • "விடையைச் சரிபார்"  while the activity is active (disabled when
 *          canCheck is false, e.g. no selection or already submitted)
 *        • "தொடர்க"             once the engine marks the activity completed
 *   2. Feedback banner — rendered by the caller via the `feedback` prop;
 *      appears after the first submission.
 *   3. Retry button — "மீண்டும் முயற்சி செய்" — only shown when
 *      `showRetry` is true (wrong answer, not yet completed).  This is a
 *      SEPARATE control; it does NOT replace or relabel விடையைச் சரிபார்.
 */
export function ActivitySubmitArea({
  onCheck,
  onNext,
  canCheck,
  status,
  feedback,
  onRetry,
  showRetry,
}: ActivitySubmitAreaProps) {
  const isCompleted = status === 'completed';

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* ── Primary action ──────────────────────────────────────────────── */}
      <div className="w-full flex justify-end">
        {isCompleted ? (
          <Button onClick={onNext} className="w-full sm:w-auto">
            தொடர்க
          </Button>
        ) : (
          <Button
            onClick={onCheck}
            disabled={!canCheck}
            className="w-full sm:w-auto"
          >
            விடையைச் சரிபார்
          </Button>
        )}
      </div>

      {/* ── Feedback banner (correct / wrong) ───────────────────────────── */}
      {feedback}

      {/* ── Separate retry control — only after a wrong submission ───────
           Rendered BELOW feedback so the visual order is:
             [விடையைச் சரிபார்]
             தவறான விடை
             [மீண்டும் முயற்சி செய்]                                       */}
      {showRetry && onRetry && (
        <div className="w-full flex justify-end">
          <Button
            onClick={onRetry}
            variant="secondary"
            autoFocus
            aria-label="மீண்டும் முயற்சி செய்"
            className="w-full sm:w-auto"
          >
            மீண்டும் முயற்சி செய்
          </Button>
        </div>
      )}
    </div>
  );
}
