import { ActivityCategory } from '../types';

// ============================================================================
// PROGRESS SCHEMA VERSION
// Schema v1: Unscoped activities map
// Schema v2: Student-scoped progress
// ============================================================================
export const PROGRESS_SCHEMA_VERSION = 1;
export const PROGRESS_SCHEMA_VERSION_V2 = 2;

// ============================================================================
// ACTIVITY-LEVEL PROGRESS
// Stores only learner state — never duplicates content.
// ============================================================================

export interface ActivityProgress {
  /** The stable student ID when student-scoped */
  studentId?: string;
  /** The stable activity ID (e.g. Q001) */
  activityId: string;
  /** The category of the activity, stored to enable category-level aggregation */
  category: ActivityCategory;
  /** True if the learner has completed this activity at least once */
  completed: boolean;
  /** True if the learner last completed this activity correctly */
  correct: boolean;
  /** Total number of attempts (increments on each submit) */
  attempts: number;
  /** Total number of correct attempts */
  correctAttempts?: number;
  /** Total number of incorrect attempts */
  incorrectAttempts?: number;
  /** Number of retry attempts (attempts after an unsuccessful attempt) */
  retryCount?: number;
  /** Best score if applicable */
  bestScore?: number;
  /** True if the learner succeeded on their very first attempt (no retries) */
  firstAttemptCorrect?: boolean;
  /** True if the final attempt was correct */
  finalCorrect?: boolean;
  /** ISO timestamp of the last time this activity was completed */
  lastCompletedAt: string;
  /** ISO timestamp of the last time an attempt was made */
  lastAttemptedAt: string;
  /** ISO timestamp of the last attempt (alias per prompt specification) */
  lastAttemptAt?: string;
}

// ============================================================================
// CATEGORY-LEVEL AGGREGATE
// ============================================================================

export interface CategoryProgress {
  category: ActivityCategory;
  total: number;
  completed: number;
  correct: number;
}

// ============================================================================
// SUBJECT-LEVEL SUMMARY
// ============================================================================

export interface ProgressSummary {
  totalActivities: number;
  totalCompleted: number;
  totalCorrect: number;
  accuracy: number; // 0–100, 0 when no completions
  byCategory: CategoryProgress[];
}

// ============================================================================
// STUDENT LEARNING METRICS (Overall learning analytics)
// ============================================================================

export interface StudentLearningMetrics {
  totalActivitiesAttempted: number;
  totalActivitiesCompleted: number;
  totalCorrectAttempts: number;
  totalIncorrectAttempts: number;
  totalRetries: number;
  firstAttemptCorrectCount: number;
  eventuallyCorrectCount: number;
  completionPercentage: number;
}

// ============================================================================
// SNAPSHOTS (what gets stored)
// ============================================================================

export interface ProgressSnapshot {
  /** Schema version — used for migration/compat checks */
  version: number;
  /** ISO timestamp of last write */
  updatedAt: string;
  /**
   * Map from activityId → ActivityProgress.
   * Legacy unscoped v1 snapshot.
   */
  activities: Record<string, ActivityProgress>;
}

export interface ProgressSnapshotV2 {
  /** Schema version 2 */
  version: 2;
  /** ISO timestamp of last write */
  updatedAt: string;
  /**
   * Nested map: studentId → activityId → ActivityProgress.
   * Guarantees total student isolation.
   */
  students: Record<string, Record<string, ActivityProgress>>;
}
