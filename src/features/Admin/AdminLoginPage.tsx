import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Lock, User, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth';
import { Button } from '../../components/ui/Button';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to admin dashboard immediately
  const destination = (location.state as { from?: string })?.from || '/admin/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, destination, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login({ username: username.trim(), password });

      if (result.success) {
        navigate(destination, { replace: true });
      } else {
        setError(result.error || 'Invalid administrator username or password.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Student Learning</span>
        </Link>
        <span className="text-xs font-mono text-text-muted px-2.5 py-1 rounded-full bg-surface-raised border border-surface-highlight">
          Admin Portal v1.0
        </span>
      </header>

      {/* Login Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-200">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 text-primary-600 mb-1 shadow-xs">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
              Admin Login
            </h1>
            <p className="text-sm text-text-muted">
              Sign in with authorized administrator credentials to review student progress and attempt diagnostics.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm font-semibold rounded-2xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-danger-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="admin-username"
                className="block text-sm font-bold text-text"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-surface-highlight bg-white text-text font-medium placeholder-text-muted/60 focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-password"
                className="block text-sm font-bold text-text"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-surface-highlight bg-white text-text font-medium placeholder-text-muted/60 focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all text-base"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="large"
              disabled={isSubmitting}
              className="w-full py-4 text-base font-bold rounded-2xl shadow-md"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In as Administrator'}
            </Button>
          </form>

        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-text-muted py-2">
        <span>Sara Learning Platform · Protected Educator & Administrator Resource</span>
      </footer>
    </div>
  );
}
