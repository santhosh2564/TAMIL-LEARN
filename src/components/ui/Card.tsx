import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'card',
        {
          'card-interactive': interactive,
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
