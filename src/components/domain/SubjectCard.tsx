import { Card } from '../ui/Card';

interface SubjectCardProps {
  subject: string;
  nativeName?: string;
  isAvailable?: boolean;
  onClick?: (subject: string) => void;
}

export function SubjectCard({ subject, nativeName, isAvailable = false, onClick }: SubjectCardProps) {
  return (
    <Card 
      interactive={isAvailable}
      onClick={() => isAvailable && onClick?.(subject)}
      className={`py-8 text-center ${!isAvailable ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-secondary-500 hover:bg-secondary-50'}`}
      aria-disabled={!isAvailable}
    >
      <h3 className="text-3xl font-display text-secondary-600 mb-2">{nativeName || subject}</h3>
      {nativeName && <p className="text-lg font-medium text-text-muted">{subject}</p>}
      
      {!isAvailable && (
        <span className="inline-block mt-4 text-xs font-bold text-white bg-text-light px-3 py-1 rounded-full uppercase tracking-wider">
          Coming Soon
        </span>
      )}
    </Card>
  );
}
