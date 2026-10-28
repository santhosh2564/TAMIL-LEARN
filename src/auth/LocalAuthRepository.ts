/**
 * LocalAuthRepository — stub retained for interface compatibility.
 *
 * Session storage is now handled server-side via a signed httpOnly cookie.
 * This class is no longer used for real session persistence; it exists only
 * to satisfy the AuthRepository interface for test overrides.
 *
 * In Phase 3+, this file will be removed entirely.
 */
import { AuthSession } from './types';
import { AuthRepository } from './AuthRepository';

export class LocalAuthRepository implements AuthRepository {
  private session: AuthSession | null = null;

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  async saveSession(session: AuthSession): Promise<void> {
    this.session = session;
  }

  async clearSession(): Promise<void> {
    this.session = null;
  }
}
