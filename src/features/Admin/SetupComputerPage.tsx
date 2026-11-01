import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Monitor, ArrowLeft, CheckCircle2, ShieldCheck, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../../auth';
import { Button } from '../../components/ui/Button';

interface SchoolItem {
  id: string;
  name: string;
  school_name?: string;
  school_code?: string;
  academic_year?: string;
}

export function SetupComputerPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  // Admin login credentials if not authenticated yet
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Schools state
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('sara_school_id') || localStorage.getItem('sara_class_id') : null;
    setCurrentSchoolId(stored);
    if (stored) setSelectedSchoolId(stored);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    async function fetchSchools() {
      try {
        setIsLoadingSchools(true);
        setError(null);
        const res = await fetch('/api/schools', { credentials: 'same-origin' });
        if (!res.ok) {
          throw new Error('Failed to load schools from server');
        }
        const data = await res.json();
        if (isMounted) {
          const list = data.schools || [];
          setSchools(list);
          if (list.length > 0 && !selectedSchoolId) {
            setSelectedSchoolId(list[0].id);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load schools');
        }
      } finally {
        if (isMounted) setIsLoadingSchools(false);
      }
    }

    fetchSchools();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, selectedSchoolId]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!username.trim() || !password) {
      setLoginError('Please enter both username and password.');
      return;
    }

    try {
      setIsLoggingIn(true);
      const res = await login({ username: username.trim(), password });
      if (!res.success) {
        setLoginError(res.error || 'Invalid administrator username or password.');
      }
    } catch {
      setLoginError('Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveSetup = () => {
    if (!selectedSchoolId) {
      setError('Please select a school for this computer.');
      return;
    }
    try {
      const sch = schools.find((s) => s.id === selectedSchoolId);
      const schoolName = sch?.school_name || sch?.name || 'School';

      localStorage.setItem('sara_school_id', selectedSchoolId);
      localStorage.setItem('sara_school_name', schoolName);
      // Also store sara_class_id for backwards compatibility
      localStorage.setItem('sara_class_id', selectedSchoolId);

      setCurrentSchoolId(selectedSchoolId);
      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/students');
      }, 1500);
    } catch {
      setError('Failed to persist configuration to local storage.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6 text-text">
      {/* Top back button */}
      <div className="w-full max-w-xl mb-4 flex items-center justify-between">
        <Link
          to="/students"
          className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Student Screen / மாணவர் பக்கம்</span>
        </Link>
        <span className="text-xs font-mono text-text-muted bg-surface-raised px-2.5 py-1 rounded-full border border-surface-highlight">
          Device Configuration
        </span>
      </div>

      <div className="w-full max-w-xl bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-2">
            <Monitor className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
            Set up this computer
          </h1>
          <p className="text-sm sm:text-base text-text-muted">
            Select which school will practice on this computer. Only students from this school will appear on this screen.
          </p>
        </div>

        {/* State A: Admin not logged in */}
        {!isAuthenticated ? (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                Admin authentication required to change this computer&apos;s school assignment.
              </span>
            </div>

            {loginError && (
              <div className="p-4 rounded-2xl bg-danger-50 border border-danger-200 text-danger-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-text-muted uppercase">
                Admin Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter administrator username"
                className="w-full px-4 py-3 bg-surface border border-surface-highlight rounded-2xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-text-muted uppercase">
                Admin Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-surface border border-surface-highlight rounded-2xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
              />
            </div>

            <Button
              type="submit"
              size="large"
              variant="primary"
              disabled={isLoggingIn}
              className="w-full py-4 text-base font-bold rounded-2xl cursor-pointer"
            >
              {isLoggingIn ? 'Verifying...' : 'Sign In as Admin to Setup'}
            </Button>
          </form>
        ) : (
          /* State B: Admin authenticated, show School selector */
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-primary-50 border border-primary-200 text-primary-900 text-xs sm:text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary-600 shrink-0" />
              <span>
                Admin session verified. Select the school to assign to this computer.
              </span>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-danger-50 border border-danger-200 text-danger-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 animate-in zoom-in-95">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Computer successfully configured! Redirecting to student screen...</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-muted uppercase">
                Assigned School
              </label>

              {isLoadingSchools ? (
                <div className="p-4 text-center text-text-muted text-sm animate-pulse">
                  Loading schools list...
                </div>
              ) : schools.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  No schools registered yet. Please create a school from the Admin portal first.
                </div>
              ) : (
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full px-4 py-3 bg-surface border border-surface-highlight rounded-2xl text-sm font-semibold text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.school_name || s.name} ({s.school_code || s.id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentSchoolId && (
              <div className="text-xs text-text-muted flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Currently configured school ID: </span>
                <span className="font-mono font-bold text-text">{currentSchoolId}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <Button
                variant="primary"
                size="large"
                onClick={handleSaveSetup}
                disabled={isLoadingSchools || schools.length === 0 || saveSuccess}
                className="w-full py-4 text-base font-bold rounded-2xl cursor-pointer"
              >
                Save and Launch Student Screen
              </Button>

              <Button
                variant="secondary"
                size="normal"
                onClick={() => navigate('/admin/dashboard')}
                className="w-full py-3 text-sm font-bold rounded-2xl cursor-pointer"
              >
                Go to Admin Portal
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-text-muted">
        Sara Learning Platform · Classroom Device Manager
      </div>
    </div>
  );
}
