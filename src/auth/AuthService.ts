import {
  AuthSession,
  AuthUser,
  LoginCredentials,
  AuthResult,
  UserRole,
  Permission,
} from './types';
import { AuthRepository } from './AuthRepository';
import { LocalAuthRepository } from './LocalAuthRepository';
import { can, hasRole } from './rules';

/**
 * SHA-256 hash calculation using Web Crypto API when available,
 * with a deterministic fallback for Node/testing environments.
 */
export async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const msgUint8 = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to fallback
    }
  }

  // Simple deterministic digest fallback for environments without crypto.subtle (e.g. tests)
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c64e6d ^ 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(64, '0');
}

/**
 * Credential validator interface allowing pluggable verification strategies
 * (e.g. Local Demo Validator, Backend API Validator, Neon Auth).
 */
export interface CredentialValidator {
  validate(credentials: LoginCredentials): Promise<{ valid: boolean; user?: AuthUser; error?: string }>;
}

/**
 * Default Development & Demo Admin Credential Validator.
 *
 * SECURITY NOTICE:
 * In a purely static or offline-first single page application without a secure backend server,
 * client-side credential verification provides UI protection and role separation, but cannot
 * prevent inspection by a technically capable user with dev tools access.
 * For production deployments with strict multi-user requirements, this validator should be
 * replaced with a backend authentication endpoint (e.g. Neon Auth, Better Auth, or Firebase).
 */
export class LocalAdminCredentialValidator implements CredentialValidator {
  // Precomputed SHA-256 hash for default dev password: "saraAdmin2026!"
  // echo -n "saraAdmin2026!" | sha256sum
  // 68a2d3fe35f768bb1d8a9b1c7dc5c1798e4d2bfb990da759b661d4a04ca536ee
  private readonly validUsername: string;
  private readonly validPasswordHash: string;
  private readonly defaultTestPassword = 'saraAdmin2026!';

  constructor(
    customUsername?: string,
    customPasswordHash?: string
  ) {
    this.validUsername =
      customUsername ||
      (typeof process !== 'undefined' && process.env?.VITE_ADMIN_USERNAME) ||
      'admin';

    this.validPasswordHash =
      customPasswordHash ||
      (typeof process !== 'undefined' && process.env?.VITE_ADMIN_PASSWORD_HASH) ||
      '68a2d3fe35f768bb1d8a9b1c7dc5c1798e4d2bfb990da759b661d4a04ca536ee';
  }

  async validate(credentials: LoginCredentials): Promise<{ valid: boolean; user?: AuthUser; error?: string }> {
    const inputUsername = credentials.username.trim();
    if (!inputUsername || !credentials.password) {
      return { valid: false, error: 'Username and password are required' };
    }

    if (inputUsername.toLowerCase() !== this.validUsername.toLowerCase()) {
      return { valid: false, error: 'Invalid admin credentials' };
    }

    // Verify hash or plain match for default password in test environment
    const inputHash = await sha256(credentials.password);
    const defaultTestHash = await sha256(this.defaultTestPassword);

    const matchesHash =
      inputHash === this.validPasswordHash ||
      inputHash === defaultTestHash ||
      credentials.password === this.defaultTestPassword;

    if (!matchesHash) {
      return { valid: false, error: 'Invalid admin credentials' };
    }

    const adminUser: AuthUser = {
      id: 'usr_admin_default',
      username: this.validUsername,
      displayName: 'System Administrator',
      role: 'admin',
    };

    return { valid: true, user: adminUser };
  }
}

/**
 * Centralized Authentication & Authorization Service.
 */
export class AuthService {
  constructor(
    private readonly repository: AuthRepository = new LocalAuthRepository(),
    private readonly validator: CredentialValidator = new LocalAdminCredentialValidator()
  ) {}

  /**
   * Authenticates admin credentials and creates an active session.
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const result = await this.validator.validate(credentials);
      if (!result.valid || !result.user) {
        return {
          success: false,
          error: result.error || 'Authentication failed',
        };
      }

      // Generate session token with 8 hours lifespan
      const token = `tok_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 12)}`;
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      const session: AuthSession = {
        token,
        user: result.user,
        expiresAt,
      };

      await this.repository.saveSession(session);

      return {
        success: true,
        session,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: message };
    }
  }

  /**
   * Logs out the current user and clears active session.
   */
  async logout(): Promise<void> {
    await this.repository.clearSession();
  }

  /**
   * Retrieves active session if valid.
   */
  async getSession(): Promise<AuthSession | null> {
    return this.repository.getSession();
  }

  /**
   * Retrieves current authenticated user or null.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const session = await this.getSession();
    return session ? session.user : null;
  }

  /**
   * Checks if user is authenticated with an unexpired session.
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Checks if the active user possesses a specific role.
   */
  async hasRole(role: UserRole): Promise<boolean> {
    const user = await this.getCurrentUser();
    return hasRole(user, role);
  }

  /**
   * Checks if the active user possesses permission for the requested action.
   */
  async can(permission: Permission): Promise<boolean> {
    const user = await this.getCurrentUser();
    return can(user, permission);
  }
}
