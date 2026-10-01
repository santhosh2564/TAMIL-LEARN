import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { useNavigate } from 'react-router-dom';

export function ErrorState({ message = 'Something went wrong', onRetry }: { message?: string; onRetry?: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center space-y-6">
      <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center">
        <AlertCircle className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text">Oops!</h2>
        <p className="text-lg text-text-muted max-w-md">{message}</p>
      </div>
      <div className="flex gap-4">
        {onRetry && (
          <Button onClick={onRetry} variant="primary">Try Again</Button>
        )}
        <Button onClick={() => navigate('/')} variant="secondary">Go Home</Button>
      </div>
    </div>
  );
}
