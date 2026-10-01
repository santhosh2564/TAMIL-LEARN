import { Card } from '../ui/Card';

interface ClassCardProps {
  level: number;
  isAvailable?: boolean;
  onClick?: (level: number) => void;
}

export function ClassCard({ level, isAvailable = false, onClick }: ClassCardProps) {
  return (
    <Card 
      interactive={isAvailable}
      onClick={() => isAvailable && onClick?.(level)}
      className={`text-center py-8 ${!isAvailable ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-primary-500'}`}
      aria-disabled={!isAvailable}
    >
      <h3 className="text-4xl font-display text-primary-600 mb-2">{level}</h3>
      <p className="text-lg font-medium text-text-muted">வகுப்பு {level}</p>
      {!isAvailable && (
        <span className="inline-block mt-4 text-xs font-bold text-white bg-text-light px-3 py-1 rounded-full uppercase tracking-wider">
          விரைவில்
        </span>
      )}
    </Card>
  );
}
