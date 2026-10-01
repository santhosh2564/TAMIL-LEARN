import { ActivityCategory } from '../types';
import { ActivityProgress, CategoryProgress, ProgressSummary } from './types';

// ============================================================================
// PROGRESS REPOSITORY INTERFACE
// UI must only interact with this interface.
// LocalProgressRepository implements it — CloudProgressRepository will too.
// ============================================================================

export interface ProgressRepository {
  /**
   * Retrieves persisted progress for a single activity.
   * Returns null if the activity has no recorded progress.
   */
  getActivityProgress(activityId: string): Promise<ActivityProgress | null>;

  /**
   * Persists progress for a single activity.
   * If progress already exists for this ID, it merges intelligently
   * (never blindly overwrites attempt history).
   */
  saveActivityProgress(progress: ActivityProgress): Promise<void>;

  /**
   * Returns all persisted progress entries.
   */
  getAllProgress(): Promise<Record<string, ActivityProgress>>;

  /**
   * Returns a progress summary filtered by the given options.
   * `availableActivityIds` drives category totals from ContentRepository counts.
   */
  getSummary(options: {
    availableCountByCategory: Record<ActivityCategory, number>;
  }): Promise<ProgressSummary>;

  /**
   * Returns category-level progress for a single category.
   */
  getCategoryProgress(
    category: ActivityCategory,
    totalInCategory: number
  ): Promise<CategoryProgress>;

  /**
   * Clears all stored progress. Irreversible.
   */
  clearProgress(): Promise<void>;
}
