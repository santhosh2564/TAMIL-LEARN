import { AttemptRecord } from './types';
import { AttemptRepository } from './AttemptRepository';
import { LocalAttemptRepository } from './LocalAttemptRepository';
import { ActivityCategory } from '../types';

export function generateAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to fallback
    }
  }
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

export interface ActivityAttemptMetrics {
  attempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  retryCount: number;
  firstAttemptCorrect: boolean;
  eventuallyCorrect: boolean;
  completed: boolean;
  lastAttemptAt?: string;
}

export class AttemptService {
  constructor(private readonly repository: AttemptRepository = new LocalAttemptRepository()) {}

  /**
   * Records an attempt made by a student for an activity.
   * Automatically calculates attemptNumber based on prior attempts for that (student, activity).
   */
  async recordAttempt(params: {
    studentId: string;
    activityId: string;
    category?: ActivityCategory;
    result: 'correct' | 'incorrect';
    completed: boolean;
  }): Promise<AttemptRecord> {
    const priorAttempts = await this.repository.getAttemptsForActivity(
      params.studentId,
      params.activityId
    );
    const attemptNumber = priorAttempts.length + 1;

    const attempt: AttemptRecord = {
      id: generateAttemptId(),
      studentId: params.studentId,
      activityId: params.activityId,
      category: params.category,
      attemptNumber,
      result: params.result,
      completed: params.completed,
      timestamp: new Date().toISOString(),
    };

    await this.repository.saveAttempt(attempt);
    return attempt;
  }

  /**
   * Retrieves all attempts for a student, optionally filtered by activityId.
   */
  async getAttempts(studentId: string, activityId?: string): Promise<AttemptRecord[]> {
    if (activityId) {
      return this.repository.getAttemptsForActivity(studentId, activityId);
    }
    return this.repository.getAttemptsForStudent(studentId);
  }

  /**
   * Computes authoritative metrics for a student's attempts on a specific activity.
   */
  async getActivityMetrics(studentId: string, activityId: string): Promise<ActivityAttemptMetrics> {
    const attempts = await this.repository.getAttemptsForActivity(studentId, activityId);

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a) => a.result === 'correct').length;
    const incorrectAttempts = attempts.filter((a) => a.result === 'incorrect').length;
    const completed = attempts.some((a) => a.completed);

    // First attempt correct
    const firstAttempt = attempts[0];
    const firstAttemptCorrect = firstAttempt ? firstAttempt.result === 'correct' : false;

    // Retry tracking:
    // A retry means the student attempts the same activity again after an unsuccessful attempt.
    // Count every attempt after an incorrect attempt.
    let retryCount = 0;
    let hadIncorrect = false;
    for (let i = 0; i < attempts.length; i++) {
      if (hadIncorrect) {
        retryCount++;
      }
      if (attempts[i].result === 'incorrect') {
        hadIncorrect = true;
      }
    }

    const eventuallyCorrect = hadIncorrect && correctAttempts > 0;
    const lastAttemptAt = attempts.length > 0 ? attempts[attempts.length - 1].timestamp : undefined;

    return {
      attempts: totalAttempts,
      correctAttempts,
      incorrectAttempts,
      retryCount,
      firstAttemptCorrect,
      eventuallyCorrect,
      completed,
      lastAttemptAt,
    };
  }

  /**
   * Deletes all attempts for a student.
   */
  async deleteStudentAttempts(studentId: string): Promise<void> {
    await this.repository.deleteAttemptsForStudent(studentId);
  }

  /**
   * Clears all attempts across all students.
   */
  async clearAllAttempts(): Promise<void> {
    await this.repository.clearAllAttempts();
  }
}
