import { ArrowLeft, Settings, Home } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './Button';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-surface-raised px-4 py-3 md:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isHome && (
            <Button variant="secondary" className="!p-3 min-w-0" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          )}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity outline-none focus-visible:ring-4 ring-primary-500 rounded-lg p-1"
          >
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              L
            </div>
            <span className="font-display font-bold text-xl hidden sm:block">Kids Learning</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isHome && (
            <Button variant="secondary" className="!p-3 min-w-0" onClick={() => navigate('/')} aria-label="Home">
              <Home className="w-6 h-6" />
            </Button>
          )}
          <Button variant="secondary" className="!p-3 min-w-0" onClick={() => navigate('/settings')} aria-label="Settings">
            <Settings className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}
