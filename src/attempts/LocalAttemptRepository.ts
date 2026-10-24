import {
  AttemptRecord,
  AttemptsSnapshot,
  ATTEMPTS_STORAGE_KEY_V1,
  ATTEMPTS_SCHEMA_VERSION,
} from './types';
import { AttemptRepository } from './AttemptRepository';

export class LocalAttemptRepository implements AttemptRepository {
  private readonly storageKey: string;

  constructor(storageKey: string = ATTEMPTS_STORAGE_KEY_V1) {
    this.storageKey = storageKey;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE: Snapshot I/O
  // ---------------------------------------------------------------------------

  private readSnapshot(): AttemptsSnapshot {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return this.emptySnapshot();

      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidSnapshot(parsed)) {
        return this.emptySnapshot();
      }

      // Sanitize attempts map
      const sanitized: Record<string, AttemptRecord[]> = {};
      for (const [studentId, attempts] of Object.entries(parsed.attemptsByStudent)) {
        if (typeof studentId === 'string' && Array.isArray(attempts)) {
          sanitized[studentId] = attempts.filter(this.isValidAttempt);
        }
      }

      return {
        version: parsed.version,
        updatedAt: parsed.updatedAt,
        attemptsByStudent: sanitized,
      };
    } catch {
      return this.emptySnapshot();
    }
  }

  private writeSnapshot(snapshot: AttemptsSnapshot): void {
    try {
      snapshot.updatedAt = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch {
      // Storage unavailable or quota exceeded — fail gracefully
    }
  }

  private emptySnapshot(): AttemptsSnapshot {
    return {
      version: ATTEMPTS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      attemptsByStudent: {},
    };
  }

  private isValidSnapshot(value: unknown): value is AttemptsSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snap = value as Record<string, unknown>;
    if (typeof snap.version !== 'number' || snap.version !== ATTEMPTS_SCHEMA_VERSION) {
      return false;
    }
    if (typeof snap.updatedAt !== 'string') return false;
    if (!snap.attemptsByStudent || typeof snap.attemptsByStudent !== 'object') return false;
    return true;
  }

  private isValidAttempt(value: unknown): value is AttemptRecord {
    if (!value || typeof value !== 'object') return false;
    const a = value as Record<string, unknown>;
    return (
      typeof a.id === 'string' &&
      typeof a.studentId === 'string' &&
      typeof a.activityId === 'string' &&
      typeof a.attemptNumber === 'number' &&
      (a.result === 'correct' || a.result === 'incorrect') &&
      typeof a.completed === 'boolean' &&
      typeof a.timestamp === 'string'
    );
  }

  // ---------------------------------------------------------------------------
  // PUBLIC: Implementation
  // ---------------------------------------------------------------------------

  async saveAttempt(attempt: AttemptRecord): Promise<void> {
    if (!this.isValidAttempt(attempt)) {
      throw new Error('Invalid attempt record');
    }

    const snapshot = this.readSnapshot();
    const studentAttempts = snapshot.attemptsByStudent[attempt.studentId] || [];
    studentAttempts.push(attempt);
    snapshot.attemptsByStudent[attempt.studentId] = studentAttempts;

    this.writeSnapshot(snapshot);
  }

  async getAttemptsForStudent(studentId: string): Promise<AttemptRecord[]> {
    if (!studentId) return [];
    const snapshot = this.readSnapshot();
    return snapshot.attemptsByStudent[studentId] || [];
  }

  async getAttemptsForActivity(studentId: string, activityId: string): Promise<AttemptRecord[]> {
    if (!studentId || !activityId) return [];
    const all = await this.getAttemptsForStudent(studentId);
    return all.filter((a) => a.activityId === activityId);
  }

  async deleteAttemptsForStudent(studentId: string): Promise<void> {
    if (!studentId) return;
    const snapshot = this.readSnapshot();
    if (snapshot.attemptsByStudent[studentId]) {
      delete snapshot.attemptsByStudent[studentId];
      this.writeSnapshot(snapshot);
    }
  }

  async clearAllAttempts(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore
    }
  }
}
