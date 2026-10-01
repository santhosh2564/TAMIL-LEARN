import { Card } from '../ui/Card';
import { ActivityCategory } from '../../types';

export interface CategoryPresentation {
  id: ActivityCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface CategoryCardProps {
  presentation: CategoryPresentation;
  activityCount: number;
  completedCount?: number;
  onClick: (category: ActivityCategory) => void;
}

export function CategoryCard({ presentation, activityCount, completedCount, onClick }: CategoryCardProps) {
  const hasProgress = typeof completedCount === 'number' && completedCount > 0;
  
  return (
    <Card 
      interactive 
      onClick={() => onClick(presentation.id)}
      className="flex flex-col h-full hover:border-accent-400"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="p-4 bg-accent-100 text-accent-500 rounded-2xl shrink-0">
          {presentation.icon}
        </div>
        <h3 className="text-xl md:text-2xl font-bold">{presentation.title}</h3>
      </div>
      <p className="text-text-muted text-base mb-6 flex-grow">{presentation.description}</p>
      <div className="mt-auto flex items-center justify-between">
        <span className="inline-flex items-center text-sm font-bold text-primary-700 bg-primary-100 px-3 py-1.5 rounded-full">
          {activityCount} செயல்கள்
        </span>
        {hasProgress && (
          <span className="text-sm font-bold text-success-600">
            {completedCount} / {activityCount} முடிந்தது
          </span>
        )}
      </div>
    </Card>
  );
}
