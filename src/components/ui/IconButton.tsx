import { ReactNode, ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
}

export const IconButton = ({ icon, className, ...props }: IconButtonProps) => {
  return (
    <button
      className={cn(
        'p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors touch-target flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
};
