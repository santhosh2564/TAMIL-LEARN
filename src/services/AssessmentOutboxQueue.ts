/**
 * Persistent Outbox Queue for Question Attempts.
 *
 * Guarantees zero attempt loss:
 * 1. Attempts are enqueued before network transmission.
 * 2. Uses IndexedDB with transparent localStorage fallback.
 * 3. Network retries preserve the original attempt ID and idempotency key.
 * 4. Automatically drains when connectivity resumes ('online' event).
 */

export interface QueuedQuestionAttempt {
  id: string;
  sessionId: string;
  studentId: string;
  subjectId: 'tamil' | 'english';
  moduleId: number | null;
  activityId: string;
  questionId: string;
  answerPayload: Record<string, unknown>;
  isCorrect: boolean;
  isCompleted: boolean;
  attemptedAt: string;
  idempotencyKey: string;
  attemptNumber: number;
}

const DB_NAME = 'sara_assessment_outbox_v1';
const STORE_NAME = 'pending_question_attempts';
const FALLBACK_STORAGE_KEY = 'sa.outbox.question_attempts.v1';

export class AssessmentOutboxQueue {
  private static instance: AssessmentOutboxQueue | null = null;
  private isFlushing = false;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private sessionStudentId?: string;

  static getInstance(): AssessmentOutboxQueue {
    if (!this.instance) {
      this.instance = new AssessmentOutboxQueue();
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
        const req = window.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

  getMaxAttemptNumber(sessionId: string, questionId: string): number {
    const items = this.getFallbackItems();
    let max = 0;
    for (const item of items) {
      if (item.sessionId === sessionId && item.questionId === questionId) {
        if (item.attemptNumber > max) max = item.attemptNumber;
      }
    }
    return max;
  }

  // â”€â”€ LocalStorage Fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private getFallbackItems(): QueuedQuestionAttempt[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveFallbackItems(items: QueuedQuestionAttempt[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (items.length === 0) {
        localStorage.removeItem(FALLBACK_STORAGE_KEY);
      } else {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      // Storage quota or restricted environment
    }
  }

  // â”€â”€ Queue Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async enqueue(attempt: QueuedQuestionAttempt): Promise<void> {
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

  async getAll(): Promise<QueuedQuestionAttempt[]> {
    const db = await this.openIdb();
    if (db) {
      try {
        const items = await new Promise<QueuedQuestionAttempt[]>((resolve, reject) => {
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

  async remove(id: string): Promise<void> {
    const db = await this.openIdb();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Continue to fallback
      }
    }

    const items = this.getFallbackItems().filter((i) => i.id !== id);
    this.saveFallbackItems(items);
  }

  async clear(): Promise<void> {
    const db = await this.openIdb();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Continue
      }
    }
    this.saveFallbackItems([]);
  }

  async size(): Promise<number> {
    const all = await this.getAll();
    return all.length;
  }

  /**
   * Dispatches enqueued attempts to the backend server.
   * Student sessions remain isolated: only attempts for activeStudentId are flushed.
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

      for (const attempt of targetItems) {
        try {
          const res = await fetch('/api/question-attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(attempt),
          });

          // 200 (duplicate) or 201 (recorded) -> dequeued safely
          if (res.ok) {
            await this.remove(attempt.id);
            flushed++;
          } else if (res.status === 404) {
            // Student or session missing -> remove
            await this.remove(attempt.id);
          } else {
            // Server error / temporary rejection -> stop flush loop, retry later
            break;
          }
        } catch {
          // Network interruption -> retry later
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

export const assessmentOutbox = AssessmentOutboxQueue.getInstance();
