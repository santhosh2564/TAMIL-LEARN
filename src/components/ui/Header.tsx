import { ArrowLeft, Settings, Home, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './Button';
import { useStudent } from '../../student';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeStudent } = useStudent();
  const isHome = location.pathname === '/';
  const isStudentsPage = location.pathname === '/students';

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-surface-raised px-2 sm:px-4 py-2 sm:py-3 md:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-4">
          {!isHome && (
            <Button variant="secondary" className="!p-2 sm:!p-3 min-w-0" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          )}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity outline-none focus-visible:ring-4 ring-primary-500 rounded-lg p-0.5 sm:p-1"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl">
              L
            </div>
            <span className="font-display font-bold text-xl hidden sm:block">Kids Learning</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Active Student Pill / Selector */}
          {!isStudentsPage && (
            <button
              onClick={() => navigate('/students', { state: { from: location.pathname } })}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-4 sm:py-2 rounded-2xl bg-surface-raised hover:bg-surface-highlight/70 border border-surface-highlight text-text font-bold text-xs sm:text-base transition-colors focus-visible:ring-4 focus-visible:ring-primary-400 outline-none cursor-pointer"
              aria-label={activeStudent ? `Active student: ${activeStudent.name}. Click to switch.` : 'Select student'}
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-primary-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-bold">
                {activeStudent ? activeStudent.name.charAt(0).toUpperCase() : <User size={13} />}
              </div>
              <span className="max-w-[70px] xs:max-w-[100px] sm:max-w-[150px] truncate">
                {activeStudent ? activeStudent.name : 'Select Student'}
              </span>
            </button>
          )}

          {!isHome && (
            <Button variant="secondary" className="!p-2 sm:!p-3 min-w-0" onClick={() => navigate('/')} aria-label="Home">
              <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          )}
          <Button variant="secondary" className="!p-2 sm:!p-3 min-w-0" onClick={() => navigate('/settings')} aria-label="Settings">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}
