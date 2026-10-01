import { Button } from '../../../components/ui/Button';
import { ReactNode } from 'react';

interface ActivitySubmitAreaProps {
  onCheck: () => void;
  onNext: () => void;
  canCheck: boolean;
  status: 'idle' | 'active' | 'completed';
  feedback?: ReactNode;
}

export function ActivitySubmitArea({ onCheck, onNext, canCheck, status, feedback }: ActivitySubmitAreaProps) {
  const isCompleted = status === 'completed';

  return (
    <div className="w-full flex flex-col space-y-4">
      {feedback}
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
    </div>
  );
}
