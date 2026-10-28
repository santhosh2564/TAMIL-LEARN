import { AuthSession } from './types';

export interface AuthRepository {
  /**
   * Retrieves active session if present and valid.
   */
  getSession(): Promise<AuthSession | null>;

  /**
   * Persists an authenticated session.
   */
  saveSession(session: AuthSession): Promise<void>;

  /**
   * Clears the persisted session.
   */
  clearSession(): Promise<void>;
}
