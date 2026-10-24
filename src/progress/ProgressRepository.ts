import { ActivityCategory } from '../types';
import { ActivityProgress, CategoryProgress, ProgressSummary } from './types';

// ============================================================================
// PROGRESS REPOSITORY INTERFACE
// UI must only interact with this interface.
// LocalProgressRepository implements it — supports student isolation.
// ============================================================================

export interface ProgressRepository {
  /**
   * Retrieves persisted progress for a single activity.
   * Scoped to studentId when provided.
   * Returns null if the activity has no recorded progress.
   */
  getActivityProgress(activityId: string, studentId?: string): Promise<ActivityProgress | null>;

  /**
   * Persists progress for a single activity.
   * Scopes to progress.studentId when present.
   * If progress already exists for this ID, it merges intelligently
   * (never blindly overwrites attempt history).
   */
  saveActivityProgress(progress: ActivityProgress): Promise<void>;

  /**
   * Returns all persisted progress entries, optionally for a specific student.
   */
  getAllProgress(studentId?: string): Promise<Record<string, ActivityProgress>>;

  /**
   * Returns a progress summary filtered by the given options.
   * Scoped to studentId when provided.
   * `availableCountByCategory` drives category totals from ContentRepository counts.
   */
  getSummary(
    options: {
      availableCountByCategory: Record<ActivityCategory, number>;
    },
    studentId?: string
  ): Promise<ProgressSummary>;

  /**
   * Returns category-level progress for a single category.
   * Scoped to studentId when provided.
   */
  getCategoryProgress(
    category: ActivityCategory,
    totalInCategory: number,
    studentId?: string
  ): Promise<CategoryProgress>;

  /**
   * Clears stored progress.
   * If studentId is provided, clears ONLY that student's progress.
   * If studentId is omitted, clears all stored progress.
   */
  clearProgress(studentId?: string): Promise<void>;

  /**
   * Specifically deletes all data for a single student.
   */
  deleteStudentProgress?(studentId: string): Promise<void>;
}
