import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthUser, LoginCredentials, Permission, UserRole } from './types';
import { AuthService } from './AuthService';
import { LocalAuthRepository } from './LocalAuthRepository';
import { can as canCheck, hasRole as hasRoleCheck } from './rules';
import { AuthContext, AuthContextValue } from './AuthContextInstance';

export function AuthProvider({
  children,
  authServiceOverride,
}: {
  children: React.ReactNode;
  authServiceOverride?: AuthService;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authService = useMemo(
    () => authServiceOverride || new AuthService(new LocalAuthRepository()),
    [authServiceOverride]
  );

  const refreshSession = useCallback(async () => {
    try {
      const activeUser = await authService.getCurrentUser();
      setUser(activeUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsLoading(true);
      try {
        const result = await authService.login(credentials);
        if (result.success && result.session) {
          setUser(result.session.user);
          return { success: true };
        } else {
          setUser(null);
          return { success: false, error: result.error || 'Invalid credentials' };
        }
      } catch (err: unknown) {
        setUser(null);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Login failed',
        };
      } finally {
        setIsLoading(false);
      }
    },
    [authService]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  const hasRole = useCallback(
    (role: UserRole) => {
      return hasRoleCheck(user, role);
    },
    [user]
  );

  const can = useCallback(
    (permission: Permission) => {
      return canCheck(user, permission);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      hasRole,
      can,
    }),
    [user, isLoading, login, logout, hasRole, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
