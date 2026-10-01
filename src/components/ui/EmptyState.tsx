import { PackageOpen } from 'lucide-react';
import { Button } from './Button';
import { useNavigate } from 'react-router-dom';

export function EmptyState({ title = 'Nothing here yet', message = 'More learning adventures are coming soon!', actionLabel, onAction }: { title?: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center space-y-6">
      <div className="w-24 h-24 bg-surface-raised text-text-light rounded-full flex items-center justify-center mb-2">
        <PackageOpen className="w-12 h-12" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text">{title}</h2>
        <p className="text-lg text-text-muted max-w-md">{message}</p>
      </div>
      
      {onAction ? (
        <Button onClick={onAction} variant="primary">{actionLabel || 'Go Back'}</Button>
      ) : (
        <Button onClick={() => navigate('/')} variant="secondary">Go Home</Button>
      )}
    </div>
  );
}
