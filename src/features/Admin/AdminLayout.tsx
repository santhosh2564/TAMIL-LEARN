import { Outlet, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, LogOut, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../auth';
import { Button } from '../../components/ui/Button';

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface text-text font-sans">
      {/* Admin Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-surface-raised/95 backdrop-blur-md border-b border-surface-highlight px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                S
              </div>
              <div>
                <div className="font-display font-extrabold text-lg text-text leading-tight flex items-center gap-2">
                  Sara Admin
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 uppercase tracking-wider">
                    Portal
                  </span>
                </div>
                <div className="text-xs text-text-muted hidden sm:block">
                  Student Progress & Analytics Dashboard
                </div>
              </div>
            </Link>

            <div className="h-6 w-px bg-surface-highlight hidden md:block" />

            <nav className="hidden md:flex items-center gap-2">
              <Link
                to="/admin/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-primary-700 bg-primary-50 border border-primary-200"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Back to student platform */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-text-muted hover:text-text hover:bg-surface border border-surface-highlight transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Student View</span>
            </Link>

            {/* Admin Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{user?.displayName || 'Administrator'}</span>
            </div>

            {/* Logout Button */}
            <Button
              variant="secondary"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-danger-600 hover:text-danger-700 hover:bg-danger-50 border border-danger-200 text-xs py-1.5 px-3"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-150">
        <Outlet />
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-surface-highlight bg-surface-raised py-6 text-xs text-text-muted text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sara Learning Platform · Administrator Console</span>
          <span className="font-mono text-[11px]">Authorized Access Only · Rule-Based Authorization Active</span>
        </div>
      </footer>
    </div>
  );
}
