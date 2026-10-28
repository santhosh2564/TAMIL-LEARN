export type UserRole = 'student' | 'admin';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export type Permission =
  | 'access:learning'
  | 'access:own_progress'
  | 'access:admin_dashboard'
  | 'view:all_students'
  | 'view:student_details'
  | 'view:student_attempts';

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

export const ADMIN_SESSION_STORAGE_KEY_V1 = 'sa.auth.session.v1';
