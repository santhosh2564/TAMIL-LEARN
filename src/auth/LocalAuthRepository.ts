import { AuthSession, ADMIN_SESSION_STORAGE_KEY_V1 } from './types';
import { AuthRepository } from './AuthRepository';

export class LocalAuthRepository implements AuthRepository {
  private readonly storageKey: string;

  constructor(storageKey: string = ADMIN_SESSION_STORAGE_KEY_V1) {
    this.storageKey = storageKey;
  }

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  async getSession(): Promise<AuthSession | null> {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(this.storageKey);
      if (!raw) return null;

      const session = JSON.parse(raw) as AuthSession;
      if (!session || !session.token || !session.user || !session.expiresAt) {
        this.clearSessionSync();
        return null;
      }

      // Check expiration
      const expiresAt = new Date(session.expiresAt).getTime();
      if (isNaN(expiresAt) || Date.now() > expiresAt) {
        this.clearSessionSync();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  async saveSession(session: AuthSession): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.setItem(this.storageKey, JSON.stringify(session));
    } catch {
      // Graceful fallback if storage quota exceeded or restricted
    }
  }

  async clearSession(): Promise<void> {
    this.clearSessionSync();
  }

  private clearSessionSync(): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.removeItem(this.storageKey);
    } catch {
      // Ignore
    }
  }
}
