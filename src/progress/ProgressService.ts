import { ActivityCategory } from '../types';
import { ActivityResult } from '../engine/types';
import { ActivityProgress, CategoryProgress, ProgressSummary } from './types';
import { ProgressRepository } from './ProgressRepository';

// ============================================================================
// PROGRESS SERVICE
// Framework-agnostic. No React imports.
// React components call ProgressService, which calls ProgressRepository.
// ============================================================================

export class ProgressService {
  constructor(private readonly repository: ProgressRepository) {}

  /**
   * Records the completion of an activity from an engine ActivityResult.
   * This is the primary integration point between the session engine and persistence.
   */
  async recordCompletion(
    result: ActivityResult,
    category: ActivityCategory
  ): Promise<void> {
    if (!result.completed) return;

    const progress: ActivityProgress = {
      activityId: result.activityId,
      category,
      completed: result.completed,
      correct: result.correct ?? false,
      attempts: result.attempts,
      lastCompletedAt: result.completedAt
        ? new Date(result.completedAt).toISOString()
        : new Date().toISOString(),
      lastAttemptedAt: new Date().toISOString(),
    };

    await this.repository.saveActivityProgress(progress);
  }

  /**
   * Retrieves progress for a single activity.
   */
  async getActivityProgress(activityId: string): Promise<ActivityProgress | null> {
    return this.repository.getActivityProgress(activityId);
  }

  /**
   * Returns a full progress summary for the given category counts.
   * Category totals must come from ContentRepository — never from progress data.
   */
  async getSummary(options: {
    availableCountByCategory: Record<ActivityCategory, number>;
  }): Promise<ProgressSummary> {
    return this.repository.getSummary(options);
  }

  /**
   * Returns category-level progress for one category.
   */
  async getCategoryProgress(
    category: ActivityCategory,
    totalInCategory: number
  ): Promise<CategoryProgress> {
    return this.repository.getCategoryProgress(category, totalInCategory);
  }

  /**
   * Returns all stored activity progress.
   */
  async getAllProgress(): Promise<Record<string, ActivityProgress>> {
    return this.repository.getAllProgress();
  }

  /**
   * Clears all stored progress. Irreversible.
   */
  async clearProgress(): Promise<void> {
    return this.repository.clearProgress();
  }
}
