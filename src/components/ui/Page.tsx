import { Header } from './Header';
import { cn } from '../../utils/cn';

interface PageProps {
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}

export function Page({ children, className, hideHeader = false }: PageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!hideHeader && <Header />}
      <main className={cn('flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-12', className)}>
        {children}
      </main>
    </div>
  );
}
