import { ReactNode } from 'react';

interface ActivityOptionGridProps {
  children: ReactNode;
}

export function ActivityOptionGrid({ children }: ActivityOptionGridProps) {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
      {children}
    </div>
  );
}
