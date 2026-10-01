import { CheckCircle2, XCircle } from 'lucide-react';

interface ActivityFeedbackProps {
  status: 'idle' | 'active' | 'completed';
  correct?: boolean;
}

export function ActivityFeedback({ status, correct }: ActivityFeedbackProps) {
  if (status !== 'completed' || correct === undefined) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full p-4 rounded-xl flex items-center gap-3 font-bold ${
        correct 
          ? 'bg-success/10 text-success'
          : 'bg-error/10 text-error'
      }`}
    >
      {correct ? (
        <>
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <span>சரியான விடை!</span>
        </>
      ) : (
        <>
          <XCircle className="w-6 h-6 shrink-0" />
          <span>தவறான விடை</span>
        </>
      )}
    </div>
  );
}
