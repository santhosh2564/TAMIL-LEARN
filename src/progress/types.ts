import { ActivityCategory } from '../types';

// ============================================================================
// PROGRESS SCHEMA VERSION
// Increment this if the stored structure changes in a breaking way.
// ============================================================================
export const PROGRESS_SCHEMA_VERSION = 1;

// ============================================================================
// ACTIVITY-LEVEL PROGRESS
// Stores only learner state — never duplicates content.
// ============================================================================

export interface ActivityProgress {
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
  /** ISO timestamp of the last time this activity was completed */
  lastCompletedAt: string;
  /** ISO timestamp of the last time an attempt was made */
  lastAttemptedAt: string;
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
// FULL SNAPSHOT (what gets stored)
// ============================================================================

export interface ProgressSnapshot {
  /** Schema version — used for migration/compat checks */
  version: number;
  /** ISO timestamp of last write */
  updatedAt: string;
  /**
   * Map from activityId → ActivityProgress.
   * Never stores content — only learner state.
   */
  activities: Record<string, ActivityProgress>;
}
