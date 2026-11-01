import { ActivityCategory } from '../types';
import { ActivityResult } from '../engine/types';
import {
  ActivityProgress,
  CategoryProgress,
  ProgressSummary,
  StudentLearningMetrics,
} from './types';
import { ProgressRepository } from './ProgressRepository';
import { LocalProgressRepository } from './LocalProgressRepository';
import { AttemptService } from '../attempts/AttemptService';
import { AttemptRecord } from '../attempts/types';
import { neonSync } from '../services/NeonSyncService';

// ============================================================================
// PROGRESS SERVICE
// Framework-agnostic. No React imports.
// Integrates with ProgressRepository and AttemptService.
// ============================================================================

export class ProgressService {
  constructor(
    private readonly repository: ProgressRepository = new LocalProgressRepository(),
    private readonly attemptService: AttemptService = new AttemptService()
  ) {}

  /**
   * Records a submitted answer attempt for a student.
   * Tracks attempt count, correctness, retries, and updates student-scoped progress.
   */
  async recordAttempt(params: {
    studentId: string;
    activityId: string;
    category: ActivityCategory;
    isCorrect: boolean;
    isCompleted: boolean;
  }): Promise<{ progress: ActivityProgress; attempt: AttemptRecord }> {
    const { studentId, activityId, category, isCorrect, isCompleted } = params;

    // 1. Record individual attempt event
    const attempt = await this.attemptService.recordAttempt({
      studentId,
      activityId,
      category,
      result: isCorrect ? 'correct' : 'incorrect',
      completed: isCompleted,
    });

    // 2. Compute cumulative metrics for this student on this activity
    const metrics = await this.attemptService.getActivityMetrics(studentId, activityId);

    const now = new Date().toISOString();
    const progress: ActivityProgress = {
      studentId,
      activityId,
      category,
      completed: metrics.completed || isCompleted,
      correct: isCorrect,
      attempts: 1, // Will be merged in repository if record exists
      correctAttempts: isCorrect ? 1 : 0,
      incorrectAttempts: !isCorrect ? 1 : 0,
      retryCount: metrics.retryCount > 0 ? 1 : 0,
      firstAttemptCorrect: metrics.firstAttemptCorrect,
      finalCorrect: isCorrect,
      lastAttemptAt: now,
      lastCompletedAt: (metrics.completed || isCompleted) ? now : '',
      lastAttemptedAt: now,
    };

    // 3. Persist student-scoped progress
    await this.repository.saveActivityProgress(progress);
    neonSync.syncAttempt(attempt).catch(() => {});

    return { progress, attempt };
  }

  /**
   * Records the completion of an activity from an engine ActivityResult.
   * Supports optional studentId for student isolation.
   */
  async recordCompletion(
    result: ActivityResult,
    category: ActivityCategory,
    studentId?: string
  ): Promise<void> {
    if (!result.completed) return;

    const isFirstAttemptCorrect = result.attempts === 1 && (result.correct ?? false);
    const retryCount = result.attempts > 1 ? result.attempts - 1 : 0;

    const progress: ActivityProgress = {
      studentId,
      activityId: result.activityId,
      category,
      completed: result.completed,
      correct: result.correct ?? false,
      attempts: result.attempts,
      correctAttempts: result.correct ? 1 : 0,
      incorrectAttempts: result.correct ? result.attempts - 1 : result.attempts,
      retryCount,
      firstAttemptCorrect: isFirstAttemptCorrect,
      finalCorrect: result.correct ?? false,
      lastCompletedAt: result.completedAt
        ? new Date(result.completedAt).toISOString()
        : new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      lastAttemptedAt: new Date().toISOString(),
    };

    await this.repository.saveActivityProgress(progress);
  }

  /**
   * Retrieves progress for a single activity, optionally scoped to a student.
   */
  async getActivityProgress(
    activityId: string,
    studentId?: string
  ): Promise<ActivityProgress | null> {
    return this.repository.getActivityProgress(activityId, studentId);
  }

  /**
   * Returns a full progress summary, optionally scoped to a student.
   * Category totals must come from ContentRepository — never from progress data.
   */
  async getSummary(
    options: {
      availableCountByCategory: Record<ActivityCategory, number>;
    },
    studentId?: string
  ): Promise<ProgressSummary> {
    return this.repository.getSummary(options, studentId);
  }

  /**
   * Returns category-level progress for one category, optionally scoped to a student.
   */
  async getCategoryProgress(
    category: ActivityCategory,
    totalInCategory: number,
    studentId?: string
  ): Promise<CategoryProgress> {
    return this.repository.getCategoryProgress(category, totalInCategory, studentId);
  }

  /**
   * Returns all stored activity progress, optionally scoped to a student.
   */
  async getAllProgress(studentId?: string): Promise<Record<string, ActivityProgress>> {
    return this.repository.getAllProgress(studentId);
  }

  /**
   * Calculates overall learning metrics for a student.
   */
  async getStudentMetrics(studentId: string): Promise<StudentLearningMetrics> {
    const all = Object.values(await this.repository.getAllProgress(studentId));

    const totalActivitiesAttempted = all.length;
    const totalActivitiesCompleted = all.filter((p) => p.completed).length;
    const totalCorrectAttempts = all.reduce((sum, p) => sum + (p.correctAttempts ?? (p.correct ? 1 : 0)), 0);
    const totalIncorrectAttempts = all.reduce((sum, p) => sum + (p.incorrectAttempts ?? (!p.correct ? 1 : 0)), 0);
    const totalRetries = all.reduce((sum, p) => sum + (p.retryCount ?? 0), 0);
    const firstAttemptCorrectCount = all.filter((p) => p.firstAttemptCorrect === true).length;
    const eventuallyCorrectCount = all.filter(
      (p) => p.completed && p.correct && (p.retryCount ?? 0) > 0
    ).length;
    const completionPercentage =
      totalActivitiesAttempted > 0
        ? Math.round((totalActivitiesCompleted / totalActivitiesAttempted) * 100)
        : 0;

    return {
      totalActivitiesAttempted,
      totalActivitiesCompleted,
      totalCorrectAttempts,
      totalIncorrectAttempts,
      totalRetries,
      firstAttemptCorrectCount,
      eventuallyCorrectCount,
      completionPercentage,
    };
  }

  /**
   * Clears progress. If studentId is supplied, only clears that student's records.
   */
  async clearProgress(studentId?: string): Promise<void> {
    await this.repository.clearProgress(studentId);
    if (studentId) {
      await this.attemptService.deleteStudentAttempts(studentId);
    }
  }

  /**
   * Deletes all data for a specific student (progress and attempts).
   */
  async deleteStudentData(studentId: string): Promise<void> {
    if (this.repository.deleteStudentProgress) {
      await this.repository.deleteStudentProgress(studentId);
    } else {
      await this.repository.clearProgress(studentId);
    }
    await this.attemptService.deleteStudentAttempts(studentId);
  }
}
