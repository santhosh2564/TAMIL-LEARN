import { ActivityCategory } from '../types';
import { ActivityProgress, CategoryProgress, ProgressSnapshot, ProgressSummary, PROGRESS_SCHEMA_VERSION } from './types';
import { ProgressRepository } from './ProgressRepository';

// ============================================================================
// STABLE NAMESPACED STORAGE KEYS
// ============================================================================
export const DEFAULT_TAMIL_STORAGE_KEY = 'sa.learning.progress.v1';
export const ENGLISH_STORAGE_KEY = 'sa.learning.progress.english.v1';
export const STORAGE_KEY = DEFAULT_TAMIL_STORAGE_KEY;

// ============================================================================
// LOCAL PROGRESS REPOSITORY
// All localStorage access is centralised here.
// ============================================================================

export class LocalProgressRepository implements ProgressRepository {
  private storageKey: string;

  constructor(storageKey: string = DEFAULT_TAMIL_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE: Snapshot I/O
  // ---------------------------------------------------------------------------

  private readSnapshot(): ProgressSnapshot {
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
      // JSON parse error, quota exceeded reads, SecurityError — degrade gracefully
      return this.emptySnapshot();
    }
  }

  private writeSnapshot(snapshot: ProgressSnapshot): void {
    try {
      snapshot.updatedAt = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch {
      // Storage unavailable or quota exceeded — continue silently
      // Persistence is an enhancement, not a crash condition
    }
  }

  private emptySnapshot(): ProgressSnapshot {
    return {
      version: PROGRESS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      activities: {},
    };
  }

  private isValidSnapshot(value: unknown): value is ProgressSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snap = value as Record<string, unknown>;
    // Must have a version we recognise
    if (snap['version'] !== PROGRESS_SCHEMA_VERSION) return false;
    if (typeof snap['updatedAt'] !== 'string') return false;
    if (!snap['activities'] || typeof snap['activities'] !== 'object') return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC: ProgressRepository implementation
  // ---------------------------------------------------------------------------

  async getActivityProgress(activityId: string): Promise<ActivityProgress | null> {
    const snapshot = this.readSnapshot();
    return snapshot.activities[activityId] ?? null;
  }

  async saveActivityProgress(incoming: ActivityProgress): Promise<void> {
    const snapshot = this.readSnapshot();
    const existing = snapshot.activities[incoming.activityId];

    if (existing) {
      // Merge: accumulate total attempts, keep best/latest states
      snapshot.activities[incoming.activityId] = {
        ...incoming,
        attempts: existing.attempts + incoming.attempts,
        // Retain ever-correct state: once correct, always show correct
        correct: existing.correct || incoming.correct,
        completed: existing.completed || incoming.completed,
        firstAttemptCorrect: existing.firstAttemptCorrect !== undefined
          ? existing.firstAttemptCorrect
          : incoming.firstAttemptCorrect,
        finalCorrect: incoming.finalCorrect ?? incoming.correct,
        lastCompletedAt: incoming.lastCompletedAt,
        lastAttemptedAt: incoming.lastAttemptedAt,
      };
    } else {
      snapshot.activities[incoming.activityId] = incoming;
    }

    this.writeSnapshot(snapshot);
  }

  async getAllProgress(): Promise<Record<string, ActivityProgress>> {
    return this.readSnapshot().activities;
  }

  async getSummary(options: {
    availableCountByCategory: Record<ActivityCategory, number>;
  }): Promise<ProgressSummary> {
    const snapshot = this.readSnapshot();
    const all = Object.values(snapshot.activities);

    const totalCompleted = all.filter(p => p.completed).length;
    const totalCorrect = all.filter(p => p.correct).length;
    const totalActivities = Object.values(options.availableCountByCategory).reduce((s, n) => s + n, 0);
    const accuracy = totalCompleted > 0 ? Math.round((totalCorrect / totalCompleted) * 100) : 0;

    const byCategory: CategoryProgress[] = (
      Object.entries(options.availableCountByCategory) as [ActivityCategory, number][]
    ).map(([category, total]) => {
      const inCat = all.filter(p => p.category === category);
      return {
        category,
        total,
        completed: inCat.filter(p => p.completed).length,
        correct: inCat.filter(p => p.correct).length,
      };
    });

    return { totalActivities, totalCompleted, totalCorrect, accuracy, byCategory };
  }

  async getCategoryProgress(
    category: ActivityCategory,
    totalInCategory: number
  ): Promise<CategoryProgress> {
    const snapshot = this.readSnapshot();
    const all = Object.values(snapshot.activities).filter(p => p.category === category);
    return {
      category,
      total: totalInCategory,
      completed: all.filter(p => p.completed).length,
      correct: all.filter(p => p.correct).length,
    };
  }

  async clearProgress(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage errors on clear
    }
  }
}
