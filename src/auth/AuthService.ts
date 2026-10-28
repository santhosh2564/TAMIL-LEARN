/**
 * AuthService — client-side authentication service.
 *
 * All credential verification happens server-side via:
 *   POST /api/admin/login   → sets httpOnly session cookie
 *   POST /api/admin/logout  → clears cookie
 *   GET  /api/admin/session → returns current user from cookie
 *
 * The client never sees or stores the raw password.
 * Session state is held server-side in a signed JWT cookie.
 */
import {
  AuthSession,
  AuthUser,
  LoginCredentials,
  AuthResult,
  UserRole,
  Permission,
} from './types';
import { can, hasRole } from './rules';

// ── Server-side credential validator ─────────────────────────────────────────

export interface ServerSessionUser {
  id: string;
  username: string;
  role: 'super_admin' | 'school_admin';
  schoolId: string | null;
}

/** Maps the server user shape to the client AuthUser shape. */
function toAuthUser(serverUser: ServerSessionUser): AuthUser {
  return {
    id: serverUser.id,
    username: serverUser.username,
    displayName: serverUser.username,
    // Treat both super_admin and school_admin as 'admin' for existing UI guards
    role: 'admin',
  };
}

// ── AuthService ──────────────────────────────────────────────────────────────

export class AuthService {
  /** POST /api/admin/login — returns a session on success */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // send/receive cookies
        body: JSON.stringify(credentials),
      });

      if (res.status === 401) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return { success: false, error: data.error || 'Invalid username or password' };
      }

      if (!res.ok) {
        return { success: false, error: 'Login failed. Please try again.' };
      }

      const data = (await res.json()) as { user: ServerSessionUser };
      const user = toAuthUser(data.user);

      // Build a lightweight client-side session object.
      // The real session lives in the httpOnly cookie — this is just for the
      // AuthContext to know who's logged in without another round-trip.
      const session: AuthSession = {
        token: 'httponly-cookie', // opaque placeholder; real token is in the cookie
        user,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      };

      return { success: true, session };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: message };
    }
  }

  /** POST /api/admin/logout — clears the httpOnly cookie */
  async logout(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Best-effort; the cookie will expire on its own
    }
  }

  /**
   * GET /api/admin/session — checks if the current cookie is still valid.
   * Called on page load to rehydrate auth state.
   * Returns null if unauthenticated.
   */
  async getSession(): Promise<AuthSession | null> {
    try {
      const res = await fetch('/api/admin/session', {
        credentials: 'same-origin',
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { user: ServerSessionUser };
      const user = toAuthUser(data.user);

      return {
        token: 'httponly-cookie',
        user,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  async hasRole(role: UserRole): Promise<boolean> {
    const user = await this.getCurrentUser();
    return hasRole(user, role);
  }

  async can(permission: Permission): Promise<boolean> {
    const user = await this.getCurrentUser();
    return can(user, permission);
  }
}
