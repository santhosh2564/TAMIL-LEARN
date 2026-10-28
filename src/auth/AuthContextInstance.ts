import { createContext } from 'react';
import { AuthUser, LoginCredentials, Permission, UserRole } from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  can: (permission: Permission) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

