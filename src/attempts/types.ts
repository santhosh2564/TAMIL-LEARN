import { ActivityCategory } from '../types';

export interface AttemptRecord {
  /** Stable unique ID for this attempt event */
  id: string;
  /** Stable unique ID of the student who made the attempt */
  studentId: string;
  /** Stable unique ID of the activity (e.g. Q001) */
  activityId: string;
  /** Activity category for aggregation */
  category?: ActivityCategory;
  /** 1-based attempt sequence number for this student on this activity */
  attemptNumber: number;
  /** Result of evaluation: 'correct' or 'incorrect' */
  result: 'correct' | 'incorrect';
  /** Whether this attempt brought the activity to completed status */
  completed: boolean;
  /** ISO timestamp when the attempt was submitted */
  timestamp: string;
}

export const ATTEMPTS_STORAGE_KEY_V1 = 'sa.learning.attempts.v1';
export const ATTEMPTS_SCHEMA_VERSION = 1;

export interface AttemptsSnapshot {
  version: number;
  updatedAt: string;
  /** Student ID -> Array of AttemptRecord in chronological order */
  attemptsByStudent: Record<string, AttemptRecord[]>;
}
