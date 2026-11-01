import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../AuthService';
import { LocalAuthRepository } from '../LocalAuthRepository';
import { can, canRole, hasRole } from '../rules';
import { AuthSession } from '../types';

// ── Mock fetch for AuthService tests ─────────────────────────────────────────
// AuthService now calls /api/admin/* endpoints.
// We mock globalThis.fetch to avoid real network calls.

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Auth Domain & AuthService', () => {
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'adm_1',
            username: 'admin',
            role: 'super_admin',
            schoolId: null,
          },
        }),
      });

      const authService = new AuthService();
      const result = await authService.login({
        username: 'admin',
        password: 'correctpassword',
      });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session!.user.username).toBe('admin');
      expect(result.session!.user.role).toBe('admin');
    });

    it('rejects invalid password with generic error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid username or password' }),
      });

      const authService = new AuthService();
      const result = await authService.login({
        username: 'admin',
        password: 'wrongPassword123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid username or password/i);
    });

    it('rejects invalid username with same generic message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid username or password' }),
      });

      const authService = new AuthService();
      const result = await authService.login({
        username: 'unknown_user',
        password: 'somepassword',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid username or password/i);
    });

    it('returns error on non-401 server failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      const authService = new AuthService();
      const result = await authService.login({
        username: 'admin',
        password: 'password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('returns error when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const authService = new AuthService();
      const result = await authService.login({
        username: 'admin',
        password: 'password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('logs out without throwing even if server call fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network gone'));

      const authService = new AuthService();
      // Should not throw
      await expect(authService.logout()).resolves.not.toThrow();
    });

    it('getSession returns null when server returns 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const authService = new AuthService();
      const session = await authService.getSession();
      expect(session).toBeNull();
    });

    it('getSession returns user when server returns 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'adm_1',
            username: 'schooladmin',
            role: 'school_admin',
            schoolId: 'sch_1',
          },
        }),
      });

      const authService = new AuthService();
      const session = await authService.getSession();
      expect(session).not.toBeNull();
      expect(session!.user.username).toBe('schooladmin');
      expect(session!.user.role).toBe('admin'); // mapped from server role
    });
  });

  describe('LocalAuthRepository (stub)', () => {
    it('stores and retrieves a session in memory', async () => {
      const repo = new LocalAuthRepository();
      const session: AuthSession = {
        token: 'httponly-cookie',
        user: {
          id: 'usr_admin',
          username: 'admin',
          displayName: 'admin',
          role: 'admin',
        },
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };

      await repo.saveSession(session);
      const retrieved = await repo.getSession();
      expect(retrieved).toEqual(session);

      await repo.clearSession();
      expect(await repo.getSession()).toBeNull();
    });
  });
});
