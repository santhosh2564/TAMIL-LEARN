import { AttemptRecord } from './types';

export interface AttemptRepository {
  /**
   * Persists an attempt record.
   */
  saveAttempt(attempt: AttemptRecord): Promise<void>;

  /**
   * Returns all attempts for a given student ID.
   */
  getAttemptsForStudent(studentId: string): Promise<AttemptRecord[]>;

  /**
   * Returns attempts for a specific student and activity.
   */
  getAttemptsForActivity(studentId: string, activityId: string): Promise<AttemptRecord[]>;

  /**
   * Deletes all attempts belonging to a specific student.
   */
  deleteAttemptsForStudent(studentId: string): Promise<void>;

  /**
   * Clears all attempts across all students.
   */
  clearAllAttempts(): Promise<void>;
}
