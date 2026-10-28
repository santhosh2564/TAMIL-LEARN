import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { LoadingState } from '../components/ui/LoadingState';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route protection guard for Administrator views.
 *
 * Enforces rule: Only authenticated users with role 'admin' can access child routes.
 * Directly navigating to an admin URL without valid credentials or authorization
 * redirects to /admin/login without rendering any admin data.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, hasRole, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <LoadingState message="Verifying authorization..." />
      </div>
    );
  }

  if (!isAuthenticated || !hasRole('admin')) {
    // Preserve attempted destination in route state
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
