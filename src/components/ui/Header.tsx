import { ArrowLeft, Settings, Home, User, LogOut, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './Button';
import { useStudent } from '../../student';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeStudent, logout } = useStudent();
  const isStudentWelcome = location.pathname === '/' || location.pathname === '/students';
  const isDashboard = location.pathname === '/subjects';

  const handleHomeClick = () => {
    if (activeStudent) {
      navigate('/subjects');
    } else {
      navigate('/');
    }
  };

  const handleDoneLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-md border-b border-emerald-100/80 px-2 sm:px-4 py-2 sm:py-3 md:px-8 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-4">
          {!isStudentWelcome && !isDashboard && (
            <Button variant="secondary" className="!p-2 sm:!p-3 min-w-0 rounded-2xl active:scale-95" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          )}
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity outline-none focus-visible:ring-4 ring-emerald-500 rounded-2xl p-0.5 sm:p-1 cursor-pointer"
            aria-label="TAMIL-LEARN Home"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-500 rounded-2xl flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-md shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex flex-col text-left hidden sm:flex">
              <span className="font-display font-black text-xl tracking-tight bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-700 bg-clip-text text-transparent">
                TAMIL-LEARN
              </span>
              <span className="text-[10px] font-extrabold text-emerald-600 tracking-wider">
                கற்றல் தளம்
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Big "I'm Done" Logout button for shared desktop hygiene */}
          {activeStudent && (
            <button
              onClick={handleDoneLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-2xl shadow-sm hover:shadow transition-all text-xs sm:text-sm cursor-pointer"
              aria-label="முடித்துவிட்டேன் / I'm done"
              title="முடித்துவிட்டேன் / I'm done"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">முடித்துவிட்டேன் / </span>
              <span>I'm Done</span>
            </button>
          )}

          {/* Active Student Pill / Selector */}
          {!isStudentWelcome && (
            <button
              onClick={() => navigate('/', { state: { from: location.pathname } })}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-2 border-emerald-200 text-emerald-950 font-extrabold text-xs sm:text-sm transition-all shadow-xs active:scale-95 cursor-pointer"
              aria-label={activeStudent ? `Active student: ${activeStudent.name}. Click to switch.` : 'Select student'}
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                {activeStudent ? activeStudent.name.charAt(0).toUpperCase() : <User size={13} />}
              </div>
              <span className="max-w-[70px] xs:max-w-[100px] sm:max-w-[150px] truncate">
                {activeStudent ? activeStudent.name : 'Select Student'}
              </span>
            </button>
          )}

          {!isStudentWelcome && !isDashboard && (
            <Button variant="secondary" className="!p-2 sm:!p-3 min-w-0 rounded-2xl active:scale-95" onClick={handleHomeClick} aria-label="Home">
              <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          )}
          <Button variant="secondary" className="!p-2 sm:!p-3 min-w-0 rounded-2xl active:scale-95" onClick={() => navigate('/settings')} aria-label="Settings">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}
