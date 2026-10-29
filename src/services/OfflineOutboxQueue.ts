import { AttemptRecord } from '../attempts/types';

const DB_NAME = 'sara_offline_v1';
const STORE_NAME = 'attempts_outbox';
const DEAD_LETTER_STORE = 'attempts_dead_letter';
const FALLBACK_STORAGE_KEY = 'sa.outbox.attempts.v1';
const FALLBACK_DEAD_LETTER_KEY = 'sa.outbox.dead_letter.v1';

export class OfflineOutboxQueue {
  private static instance: OfflineOutboxQueue | null = null;
  private isFlushing = false;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  /** Student of the current server session; set by StudentProvider. */
  private sessionStudentId: string | undefined;

  static getInstance(): OfflineOutboxQueue {
    if (!this.instance) {
      this.instance = new OfflineOutboxQueue();
    }
    return this.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flush(this.sessionStudentId).catch(() => {});
      });
    }
  }

  setSessionStudent(studentId: string | null): void {
    this.sessionStudentId = studentId ?? undefined;
  }

  private async openIdb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
            db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  // ── LocalStorage Fallback ───────────────────────────────────────────────────
  private getFallbackItems(key = FALLBACK_STORAGE_KEY): AttemptRecord[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveFallbackItems(items: AttemptRecord[], key = FALLBACK_STORAGE_KEY): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (items.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(items));
      }
    } catch {
      // Quota exceeded
    }
  }

  // ── Public Queue Methods ────────────────────────────────────────────────────
  async enqueue(attempt: AttemptRecord): Promise<void> {
    const db = await this.openIdb();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(attempt);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        return;
      } catch {
        // Fall back to localStorage
      }
    }

    const items = this.getFallbackItems().filter((item) => item.id !== attempt.id);
    items.push(attempt);
    this.saveFallbackItems(items);
  }

  async getAll(): Promise<AttemptRecord[]> {
    const db = await this.openIdb();
    if (db) {
      try {
        const items = await new Promise<AttemptRecord[]>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        return items;
      } catch {
        // Fall back
      }
    }

    return this.getFallbackItems();
  }

  async getItems(): Promise<AttemptRecord[]> {
    return this.getAll();
  }

  async remove(attemptId: string): Promise<void> {
    const db = await this.openIdb();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(attemptId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Continue to fallback
      }
    }

    const items = this.getFallbackItems().filter((i) => i.id !== attemptId);
    this.saveFallbackItems(items);
  }

  async moveToDeadLetter(attempt: AttemptRecord): Promise<void> {
    await this.remove(attempt.id);
    const db = await this.openIdb();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
          tx.objectStore(DEAD_LETTER_STORE).put(attempt);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        return;
      } catch {
        // Fall back
      }
    }

    const deadLetters = this.getFallbackItems(FALLBACK_DEAD_LETTER_KEY).filter((i) => i.id !== attempt.id);
    deadLetters.push(attempt);
    this.saveFallbackItems(deadLetters, FALLBACK_DEAD_LETTER_KEY);
  }

  async getDeadLetterItems(): Promise<AttemptRecord[]> {
    const db = await this.openIdb();
    if (db) {
      try {
        const items = await new Promise<AttemptRecord[]>((resolve, reject) => {
          const tx = db.transaction(DEAD_LETTER_STORE, 'readonly');
          const req = tx.objectStore(DEAD_LETTER_STORE).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        return items;
      } catch {
        // Fall back
      }
    }

    return this.getFallbackItems(FALLBACK_DEAD_LETTER_KEY);
  }

  async size(): Promise<number> {
    const all = await this.getAll();
    return all.length;
  }

  /**
   * Attempts to drain enqueued attempts for the active student to the server.
   * Isolates student sessions: items for student A are NEVER sent under student B's session.
   */
  async flush(activeStudentId?: string): Promise<{ flushed: number; remaining: number }> {
    if (this.isFlushing) return { flushed: 0, remaining: await this.size() };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { flushed: 0, remaining: await this.size() };
    }

    this.isFlushing = true;
    let flushed = 0;

    try {
      const items = await this.getAll();
      const targetItems = activeStudentId
        ? items.filter((item) => item.studentId === activeStudentId)
        : items;

      const { neonSync } = await import('./NeonSyncService');

      for (const attempt of targetItems) {
        try {
          const ok = await neonSync.syncAttempt(attempt);
          if (ok) {
            flushed++;
          }
        } catch {
          break;
        }
      }
    } finally {
      this.isFlushing = false;
    }

    const remaining = await this.size();
    return { flushed, remaining };
  }
}

export const offlineOutbox = OfflineOutboxQueue.getInstance();
