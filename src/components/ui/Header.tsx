import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Settings, Home, User, LogOut, Palette, Check } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './Button';
import { useStudent } from '../../student';
import { useTheme, THEME_CONFIGS, ThemeId } from '../../theme';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeStudent, logout } = useStudent();
  const { currentTheme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const isHome = location.pathname === '/';
  const isStudentsPage = location.pathname === '/students';

  // Close theme dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    }
    if (showThemeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemeMenu]);

  const handleDoneLogout = async () => {
    await logout();
    navigate('/');
  };

  const themeList = Object.values(THEME_CONFIGS);

  return (
    <header className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border/80 px-2 sm:px-4 py-2 sm:py-3 md:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left Side: Back button and Brand */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {!isHome && (
            <Button
              variant="secondary"
              className="!p-2 sm:!p-2.5 min-w-0 rounded-2xl shadow-sm hover:shadow transition-all"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          )}

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-90 transition-transform active:scale-95 outline-none focus-visible:ring-4 ring-primary-400 rounded-2xl p-1"
            aria-label="Sara Kids Learning Home"
          >
            {/* Playful brand icon */}
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-tr from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-button transform -rotate-3 hover:rotate-0 transition-transform">
              ✨
            </div>
            <div className="flex flex-col text-left">
              <span className="font-display font-extrabold text-lg sm:text-2xl text-text leading-tight tracking-tight">
                சாரா <span className="text-primary-600 text-sm sm:text-lg font-bold">· Sara</span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-text-muted block -mt-0.5">
                வகுப்பு 2 & 3 கற்றல் தளம் · Kids Learning
              </span>
            </div>
          </button>
        </div>

        {/* Right Side: Theme switcher, Logout, Student Pill, Home, Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Quick Theme Switcher Pill */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu((prev) => !prev)}
              aria-expanded={showThemeMenu}
              aria-label={`Theme: ${(THEME_CONFIGS[currentTheme] || THEME_CONFIGS.ocean).nameEn}. Click to change.`}
              className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-2xl bg-surface-raised hover:bg-surface-highlight border border-border text-text font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95"
              title="Change Theme / தோற்றத்தை மாற்று"
            >
              <Palette className="w-4 h-4 text-primary-500" />
              <span className="hidden md:inline">{(THEME_CONFIGS[currentTheme] || THEME_CONFIGS.ocean).emoji}</span>
              <span className="hidden lg:inline text-xs">{(THEME_CONFIGS[currentTheme] || THEME_CONFIGS.ocean).nameEn}</span>
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-surface rounded-3xl shadow-xl border-2 border-border p-2 z-50 animate-scaleIn">
                <div className="px-3 py-2 text-xs font-bold text-text-muted border-b border-border mb-1">
                  தோற்றத்தை மாற்று · Choose Theme
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {themeList.map((t) => {
                    const isSelected = t.id === currentTheme;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id as ThemeId);
                          setShowThemeMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs sm:text-sm font-bold transition-all ${
                          isSelected
                            ? 'bg-primary-500 text-white shadow-sm'
                            : 'hover:bg-surface-highlight text-text'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{t.emoji}</span>
                          <span>{t.nameTa}</span>
                          <span className={isSelected ? 'text-white/80 text-[11px]' : 'text-text-muted text-[11px]'}>
                            ({t.nameEn})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-inner"
                            style={{ backgroundColor: t.previewColor }}
                          />
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Big "I'm Done" Logout button for shared desktop hygiene */}
          {activeStudent && (
            <button
              onClick={handleDoneLogout}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold rounded-2xl shadow-sm hover:shadow transition-all text-xs sm:text-sm cursor-pointer"
              aria-label="முடித்துவிட்டேன் / I'm done"
              title="முடித்துவிட்டேன் / I'm done"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">முடித்துவிட்டேன் / </span>
              <span>I'm Done</span>
            </button>
          )}

          {/* Active Student Pill / Selector */}
          {!isStudentsPage && (
            <button
              onClick={() => navigate('/students', { state: { from: location.pathname } })}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-surface-raised hover:bg-surface-highlight border border-border text-text font-bold text-xs sm:text-sm transition-all focus-visible:ring-4 focus-visible:ring-primary-400 outline-none cursor-pointer shadow-sm active:scale-95"
              aria-label={activeStudent ? `Active student: ${activeStudent.name}. Click to switch.` : 'Select student'}
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-tr from-primary-500 to-secondary-500 text-white flex items-center justify-center text-xs font-black shadow-inner">
                {activeStudent ? activeStudent.name.charAt(0).toUpperCase() : <User size={14} />}
              </div>
              <span className="max-w-[70px] xs:max-w-[100px] sm:max-w-[130px] truncate">
                {activeStudent ? activeStudent.name : 'Select Student'}
              </span>
            </button>
          )}

          {!isHome && (
            <Button
              variant="secondary"
              className="!p-2 sm:!p-2.5 min-w-0 rounded-2xl shadow-sm hover:shadow"
              onClick={() => navigate('/')}
              aria-label="Home"
            >
              <Home className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
            </Button>
          )}

          <Button
            variant="secondary"
            className="!p-2 sm:!p-2.5 min-w-0 rounded-2xl shadow-sm hover:shadow"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
