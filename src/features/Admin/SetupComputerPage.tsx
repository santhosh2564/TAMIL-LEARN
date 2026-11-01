import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Monitor, ArrowLeft, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth';
import { Button } from '../../components/ui/Button';

interface ClassItem {
  id: string;
  name: string;
  grade: string;
  class_code: string;
}

export function SetupComputerPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  // Admin login credentials if not authenticated yet
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Classes state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('sara_class_id') : null;
    setCurrentClassId(stored);
    if (stored) setSelectedClassId(stored);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    async function fetchClasses() {
      try {
        setIsLoadingClasses(true);
        setError(null);
        const res = await fetch('/api/admin/classes', { credentials: 'same-origin' });
        if (!res.ok) {
          throw new Error('Failed to load classes from server');
        }
        const data = await res.json();
        if (isMounted) {
          const list = (data.classes || []).filter((c: ClassItem & { archived_at?: string | null }) => !c.archived_at);
          setClasses(list);
          if (list.length > 0 && !selectedClassId) {
            setSelectedClassId(list[0].id);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load classes');
        }
      } finally {
        if (isMounted) setIsLoadingClasses(false);
      }
    }

    fetchClasses();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, selectedClassId]);

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
    if (!selectedClassId) {
      setError('Please select a class for this computer.');
      return;
    }
    try {
      localStorage.setItem('sara_class_id', selectedClassId);
      setCurrentClassId(selectedClassId);
      setSaveSuccess(true);
    } catch {
      setError('Unable to save settings to localStorage.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link
          to="/students"
          className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Student Screen / மாணவர் பக்கம்</span>
        </Link>
        <span className="text-xs font-mono text-text-muted px-2.5 py-1 rounded-full bg-surface-raised border border-surface-highlight">
          Device Configuration
        </span>
      </header>

      <div className="w-full max-w-xl mx-auto my-8">
        <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-200">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 text-primary-600 mb-1">
              <Monitor className="w-9 h-9" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
              Set up this computer
            </h1>
            <p className="text-sm text-text-muted">
              Select which class will practice on this computer. Only students from this class will appear on this screen.
            </p>
          </div>

          {!isAuthenticated ? (
            <div className="space-y-6 pt-2">
              <div className="p-4 bg-primary-50/70 border border-primary-200 rounded-2xl flex items-center gap-3 text-xs text-primary-900">
                <ShieldCheck className="w-5 h-5 text-primary-700 shrink-0" />
                <span>
                  Admin authentication required to change this computer's class assignment.
                </span>
              </div>

              {loginError && (
                <div className="p-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm font-semibold rounded-2xl flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-danger-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-text">Admin Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full px-4 py-2.5 rounded-xl border border-surface-highlight bg-white text-text text-sm font-medium focus:ring-4 focus:ring-primary-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-text">Admin Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-2.5 rounded-xl border border-surface-highlight bg-white text-text text-sm font-medium focus:ring-4 focus:ring-primary-100 focus:outline-none"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="large"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 text-sm font-bold rounded-2xl cursor-pointer"
                >
                  {isLoggingIn ? 'Authenticating...' : 'Sign In as Admin to Setup'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {saveSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-2xl flex items-center gap-3 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    Saved! This computer is now set up. Students will see their names when they tap "Who is Learning?".
                  </span>
                </div>
              )}

              {error && (
                <div className="p-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm font-semibold rounded-2xl">
                  {error}
                </div>
              )}

              {currentClassId && (
                <div className="p-3 bg-surface border border-surface-highlight rounded-xl text-xs flex items-center justify-between">
                  <span className="text-text-muted">Current setup on this PC:</span>
                  <span className="font-bold text-primary-700 font-mono">
                    {classes.find((c) => c.id === currentClassId)?.name || currentClassId}
                  </span>
                </div>
              )}

              {isLoadingClasses ? (
                <div className="py-8 text-center text-text-muted animate-pulse">
                  Loading classes...
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-text-muted text-sm">No classes found for your school.</p>
                  <Button
                    variant="secondary"
                    size="normal"
                    onClick={() => navigate('/admin/dashboard')}
                  >
                    Go to Dashboard to Add a Class
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                    Choose Class for this Computer:
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto px-1 py-1">
                    {classes.map((cls) => {
                      const isSelected = selectedClassId === cls.id;
                      return (
                        <div
                          key={cls.id}
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            setSaveSuccess(false);
                          }}
                          className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50/70 shadow-xs'
                              : 'border-surface-highlight bg-white hover:border-primary-300'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-text text-base">{cls.name}</div>
                            <div className="text-xs text-text-muted">{cls.grade}</div>
                          </div>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      size="large"
                      onClick={handleSaveSetup}
                      className="w-full sm:flex-1 py-4 text-base font-bold rounded-2xl shadow-sm cursor-pointer"
                    >
                      Save Setup / அமைப்பைச் சேமி
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="large"
                      onClick={() => navigate('/students')}
                      className="w-full sm:w-auto py-4 px-6 text-base font-bold rounded-2xl cursor-pointer"
                    >
                      Go to Student Screen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="text-center text-xs text-text-muted py-2">
        <span>Sara Learning Platform · Classroom Device Manager</span>
      </footer>
    </div>
  );
}

