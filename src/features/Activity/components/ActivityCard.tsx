import { ReactNode } from 'react';

interface ActivityCardProps {
  children: ReactNode;
  className?: string;
}

export function ActivityCard({ children, className = '' }: ActivityCardProps) {
  return (
    <div className={`w-full max-w-2xl mx-auto flex flex-col items-center space-y-6 ${className}`}>
      {children}
    </div>
  );
}
