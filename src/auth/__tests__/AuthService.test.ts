import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../AuthService';
import { LocalAuthRepository } from '../LocalAuthRepository';
import { can, canRole, hasRole } from '../rules';
import { ADMIN_SESSION_STORAGE_KEY_V1, AuthSession } from '../types';

describe('Auth Domain & AuthService', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    });
  });

  describe('Rule-Based Permissions & Role Checking', () => {
    it('grants learning and own progress to student role, but denies admin dashboard and student records', () => {
      expect(canRole('student', 'access:learning')).toBe(true);
      expect(canRole('student', 'access:own_progress')).toBe(true);
      expect(canRole('student', 'access:admin_dashboard')).toBe(false);
      expect(canRole('student', 'view:all_students')).toBe(false);
      expect(canRole('student', 'view:student_details')).toBe(false);
      expect(canRole('student', 'view:student_attempts')).toBe(false);
    });

    it('grants full admin permissions to admin role', () => {
      expect(canRole('admin', 'access:learning')).toBe(true);
      expect(canRole('admin', 'access:own_progress')).toBe(true);
      expect(canRole('admin', 'access:admin_dashboard')).toBe(true);
      expect(canRole('admin', 'view:all_students')).toBe(true);
      expect(canRole('admin', 'view:student_details')).toBe(true);
      expect(canRole('admin', 'view:student_attempts')).toBe(true);
    });

    it('denies all permissions when role or user is undefined or null', () => {
      expect(canRole(null, 'access:admin_dashboard')).toBe(false);
      expect(can(null, 'access:admin_dashboard')).toBe(false);
      expect(hasRole(null, 'admin')).toBe(false);
    });
  });

  describe('Admin Login & Session Management', () => {
    it('authenticates valid admin credentials successfully', async () => {
      const authService = new AuthService(new LocalAuthRepository());

      const result = await authService.login({
        username: 'admin',
        password: 'saraAdmin2026!',
      });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session!.user.username).toBe('admin');
      expect(result.session!.user.role).toBe('admin');

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(true);

      const currentUser = await authService.getCurrentUser();
      expect(currentUser).not.toBeNull();
      expect(currentUser!.role).toBe('admin');

      const canAccessAdmin = await authService.can('access:admin_dashboard');
      expect(canAccessAdmin).toBe(true);
    });

    it('rejects invalid password', async () => {
      const authService = new AuthService(new LocalAuthRepository());

      const result = await authService.login({
        username: 'admin',
        password: 'wrongPassword123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid admin credentials/i);

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it('rejects invalid username', async () => {
      const authService = new AuthService(new LocalAuthRepository());

      const result = await authService.login({
        username: 'unknown_user',
        password: 'saraAdmin2026!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid admin credentials/i);

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it('rejects empty credentials', async () => {
      const authService = new AuthService(new LocalAuthRepository());

      const result = await authService.login({
        username: '   ',
        password: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it('logs out and clears active admin session', async () => {
      const authService = new AuthService(new LocalAuthRepository());

      await authService.login({
        username: 'admin',
        password: 'saraAdmin2026!',
      });
      expect(await authService.isAuthenticated()).toBe(true);

      await authService.logout();
      expect(await authService.isAuthenticated()).toBe(false);
      expect(await authService.getCurrentUser()).toBeNull();
    });

    it('invalidates expired sessions automatically', async () => {
      const repo = new LocalAuthRepository();
      const expiredSession: AuthSession = {
        token: 'tok_expired',
        user: {
          id: 'usr_admin',
          username: 'admin',
          displayName: 'Admin',
          role: 'admin',
        },
        // Expired 1 hour ago
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      };

      store[ADMIN_SESSION_STORAGE_KEY_V1] = JSON.stringify(expiredSession);

      const session = await repo.getSession();
      expect(session).toBeNull();
    });
  });
});
