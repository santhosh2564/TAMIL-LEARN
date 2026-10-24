import { ActivityCategory } from '../types';
import {
  ActivityProgress,
  CategoryProgress,
  ProgressSummary,
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_SCHEMA_VERSION_V2,
} from './types';
import { ProgressRepository } from './ProgressRepository';

// ============================================================================
// STABLE NAMESPACED STORAGE KEYS
// ============================================================================
export const DEFAULT_TAMIL_STORAGE_KEY = 'sa.learning.progress.v1';
export const ENGLISH_STORAGE_KEY = 'sa.learning.progress.english.v1';
export const PROGRESS_STORAGE_KEY_V2 = 'sa.learning.progress.v2';
export const STORAGE_KEY = DEFAULT_TAMIL_STORAGE_KEY;

// ============================================================================
// COMBINED INTERNAL SNAPSHOT TYPE
// ============================================================================
interface CombinedSnapshot {
  version: number;
  updatedAt: string;
  activities?: Record<string, ActivityProgress>;
  students?: Record<string, Record<string, ActivityProgress>>;
}

// ============================================================================
// LOCAL PROGRESS REPOSITORY
// Implements student-scoped progress with full backwards compatibility.
// ============================================================================

export class LocalProgressRepository implements ProgressRepository {
  private readonly storageKey: string;
  private readonly defaultStudentId?: string;

  constructor(
    storageKey: string = DEFAULT_TAMIL_STORAGE_KEY,
    defaultStudentId?: string
  ) {
    this.storageKey = storageKey;
    this.defaultStudentId = defaultStudentId;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE: Snapshot I/O
  // ---------------------------------------------------------------------------

  private readSnapshot(): CombinedSnapshot {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return this.emptySnapshot();

      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidSnapshot(parsed)) {
        // Malformed or incompatible version — fall back silently
        return this.emptySnapshot();
      }
      return parsed;
    } catch {
      // Storage unavailable, quota error, SecurityError — degrade gracefully
      return this.emptySnapshot();
    }
  }

  private writeSnapshot(snapshot: CombinedSnapshot): void {
    try {
      snapshot.updatedAt = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch {
      // Storage unavailable or quota exceeded — continue silently
    }
  }

  private emptySnapshot(): CombinedSnapshot {
    if (this.storageKey === PROGRESS_STORAGE_KEY_V2) {
      return {
        version: PROGRESS_SCHEMA_VERSION_V2,
        updatedAt: new Date().toISOString(),
        students: {},
      };
    }

    return {
      version: PROGRESS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      activities: {},
      students: {},
    };
  }

  private isValidSnapshot(value: unknown): value is CombinedSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snap = value as Record<string, unknown>;
    // Must have a version we recognize (1 or 2)
    if (
      snap['version'] !== PROGRESS_SCHEMA_VERSION &&
      snap['version'] !== PROGRESS_SCHEMA_VERSION_V2
    ) {
      return false;
    }
    if (typeof snap['updatedAt'] !== 'string') return false;
    return true;
  }

  private resolveStudentId(explicitStudentId?: string): string | undefined {
    return explicitStudentId || this.defaultStudentId;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC: ProgressRepository implementation
  // ---------------------------------------------------------------------------

  async getActivityProgress(
    activityId: string,
    studentId?: string
  ): Promise<ActivityProgress | null> {
    const sId = this.resolveStudentId(studentId);
    const snapshot = this.readSnapshot();

    if (sId) {
      if (snapshot.students && snapshot.students[sId]) {
        return snapshot.students[sId][activityId] ?? null;
      }
      return null;
    }

    // Unscoped fallback (schema v1)
    if (snapshot.activities) {
      return snapshot.activities[activityId] ?? null;
    }

    return null;
  }

  async saveActivityProgress(incoming: ActivityProgress): Promise<void> {
    const sId = this.resolveStudentId(incoming.studentId);
    const snapshot = this.readSnapshot();

    if (sId) {
      // Ensure student map exists
      if (!snapshot.students) {
        snapshot.students = {};
      }
      if (!snapshot.students[sId]) {
        snapshot.students[sId] = {};
      }

      const existing = snapshot.students[sId][incoming.activityId];
      if (existing) {
        const totalAttempts = existing.attempts + incoming.attempts;
        const correctAttempts =
          (existing.correctAttempts ?? (existing.correct ? existing.attempts : 0)) +
          (incoming.correctAttempts ?? (incoming.correct ? incoming.attempts : 0));
        const incorrectAttempts =
          (existing.incorrectAttempts ?? (!existing.correct ? existing.attempts : 0)) +
          (incoming.incorrectAttempts ?? (!incoming.correct ? incoming.attempts : 0));
        const retryCount = (existing.retryCount ?? 0) + (incoming.retryCount ?? 0);

        snapshot.students[sId][incoming.activityId] = {
          ...incoming,
          studentId: sId,
          attempts: totalAttempts,
          correctAttempts,
          incorrectAttempts,
          retryCount,
          correct: existing.correct || incoming.correct,
          completed: existing.completed || incoming.completed,
          firstAttemptCorrect:
            existing.firstAttemptCorrect !== undefined
              ? existing.firstAttemptCorrect
              : incoming.firstAttemptCorrect,
          finalCorrect: incoming.finalCorrect ?? incoming.correct,
          bestScore: Math.max(existing.bestScore ?? 0, incoming.bestScore ?? 0),
          lastCompletedAt: incoming.lastCompletedAt || existing.lastCompletedAt,
          lastAttemptedAt: incoming.lastAttemptedAt || existing.lastAttemptedAt,
        };
      } else {
        snapshot.students[sId][incoming.activityId] = {
          ...incoming,
          studentId: sId,
          correctAttempts:
            incoming.correctAttempts ?? (incoming.correct ? incoming.attempts : 0),
          incorrectAttempts:
            incoming.incorrectAttempts ?? (!incoming.correct ? incoming.attempts : 0),
          retryCount: incoming.retryCount ?? 0,
        };
      }
    } else {
      // Unscoped legacy v1 behavior
      if (!snapshot.activities) {
        snapshot.activities = {};
      }
      const existing = snapshot.activities[incoming.activityId];

      if (existing) {
        snapshot.activities[incoming.activityId] = {
          ...incoming,
          attempts: existing.attempts + incoming.attempts,
          correct: existing.correct || incoming.correct,
          completed: existing.completed || incoming.completed,
          firstAttemptCorrect:
            existing.firstAttemptCorrect !== undefined
              ? existing.firstAttemptCorrect
              : incoming.firstAttemptCorrect,
          finalCorrect: incoming.finalCorrect ?? incoming.correct,
          lastCompletedAt: incoming.lastCompletedAt,
          lastAttemptedAt: incoming.lastAttemptedAt,
        };
      } else {
        snapshot.activities[incoming.activityId] = incoming;
      }
    }

    this.writeSnapshot(snapshot);
  }

  async getAllProgress(studentId?: string): Promise<Record<string, ActivityProgress>> {
    const sId = this.resolveStudentId(studentId);
    const snapshot = this.readSnapshot();

    if (sId) {
      return snapshot.students?.[sId] ?? {};
    }

    return snapshot.activities ?? {};
  }

  async getSummary(
    options: {
      availableCountByCategory: Record<ActivityCategory, number>;
    },
    studentId?: string
  ): Promise<ProgressSummary> {
    const activities = await this.getAllProgress(studentId);
    const all = Object.values(activities);

    const totalCompleted = all.filter((p) => p.completed).length;
    const totalCorrect = all.filter((p) => p.correct).length;
    const totalActivities = Object.values(options.availableCountByCategory).reduce(
      (s, n) => s + n,
      0
    );
    const accuracy = totalCompleted > 0 ? Math.round((totalCorrect / totalCompleted) * 100) : 0;

    const byCategory: CategoryProgress[] = (
      Object.entries(options.availableCountByCategory) as [ActivityCategory, number][]
    ).map(([category, total]) => {
      const inCat = all.filter((p) => p.category === category);
      return {
        category,
        total,
        completed: inCat.filter((p) => p.completed).length,
        correct: inCat.filter((p) => p.correct).length,
      };
    });

    return { totalActivities, totalCompleted, totalCorrect, accuracy, byCategory };
  }

  async getCategoryProgress(
    category: ActivityCategory,
    totalInCategory: number,
    studentId?: string
  ): Promise<CategoryProgress> {
    const activities = await this.getAllProgress(studentId);
    const inCat = Object.values(activities).filter((p) => p.category === category);

    return {
      category,
      total: totalInCategory,
      completed: inCat.filter((p) => p.completed).length,
      correct: inCat.filter((p) => p.correct).length,
    };
  }

  async clearProgress(studentId?: string): Promise<void> {
    const sId = this.resolveStudentId(studentId);
    try {
      if (sId) {
        const snapshot = this.readSnapshot();
        if (snapshot.students && snapshot.students[sId]) {
          delete snapshot.students[sId];
          this.writeSnapshot(snapshot);
        }
      } else {
        localStorage.removeItem(this.storageKey);
      }
    } catch {
      // Ignore storage errors on clear
    }
  }

  async deleteStudentProgress(studentId: string): Promise<void> {
    if (!studentId) return;
    try {
      const snapshot = this.readSnapshot();
      if (snapshot.students && snapshot.students[studentId]) {
        delete snapshot.students[studentId];
        this.writeSnapshot(snapshot);
      }
    } catch {
      // Ignore
    }
  }
}
