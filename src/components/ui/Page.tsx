import { Header } from './Header';
import { Footer } from './Footer';
import { FloatingDecorations, DecorationVariant } from './FloatingDecorations';
import { cn } from '../../utils/cn';

interface PageProps {
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
  decorationsVariant?: DecorationVariant;
}

export function Page({
  children,
  className,
  hideHeader = false,
  hideFooter = false,
  decorationsVariant = 'ambient',
}: PageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-x-hidden selection:bg-primary-200 selection:text-primary-900 transition-colors duration-300">
      {/* Decorative floating shapes in background (accessible, non-distracting) */}
      <FloatingDecorations variant={decorationsVariant} />

      {!hideHeader && <Header />}

      <main className={cn('flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-12 relative z-[1]', className)}>
        {children}
      </main>

      {!hideFooter && !hideHeader && <Footer />}
    </div>
  );
}
