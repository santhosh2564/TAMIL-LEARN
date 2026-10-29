import { Header } from './Header';
import { Footer } from './Footer';
import { cn } from '../../utils/cn';

interface PageProps {
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export function Page({ children, className, hideHeader = false, hideFooter = false }: PageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!hideHeader && <Header />}
      <main className={cn('flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-12', className)}>
        {children}
      </main>
      {!hideFooter && !hideHeader && <Footer />}
    </div>
  );
}
