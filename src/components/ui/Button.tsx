import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'normal' | 'large';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'normal', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'btn',
        {
          'btn-primary': variant === 'primary',
          'btn-secondary': variant === 'secondary',
          'btn-icon': variant === 'icon',
          'text-lg md:text-xl py-4 px-8': size === 'large',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
