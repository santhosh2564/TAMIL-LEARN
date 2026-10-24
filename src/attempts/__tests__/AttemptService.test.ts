import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalAttemptRepository } from '../LocalAttemptRepository';
import { AttemptService } from '../AttemptService';
import { ATTEMPTS_STORAGE_KEY_V1 } from '../types';

describe('Attempt Domain & AttemptService', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  describe('Single-attempt & Retry lifecycle', () => {
    it('tracks a correct first attempt (no retries)', async () => {
      const service = new AttemptService(new LocalAttemptRepository());

      const attempt = await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'Q001',
        category: 'picture-recognition',
        result: 'correct',
        completed: true,
      });

      expect(attempt.attemptNumber).toBe(1);
      expect(attempt.result).toBe('correct');
      expect(attempt.completed).toBe(true);

      const metrics = await service.getActivityMetrics('student_1', 'Q001');
      expect(metrics.attempts).toBe(1);
      expect(metrics.correctAttempts).toBe(1);
      expect(metrics.incorrectAttempts).toBe(0);
      expect(metrics.retryCount).toBe(0);
      expect(metrics.firstAttemptCorrect).toBe(true);
      expect(metrics.eventuallyCorrect).toBe(false);
      expect(metrics.completed).toBe(true);
    });

    it('tracks incorrect then correct (retryCount = 1)', async () => {
      const service = new AttemptService(new LocalAttemptRepository());

      // Attempt 1: Incorrect
      const att1 = await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'Q001',
        category: 'spelling-choice',
        result: 'incorrect',
        completed: false,
      });
      expect(att1.attemptNumber).toBe(1);

      // Attempt 2: Correct
      const att2 = await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'Q001',
        category: 'spelling-choice',
        result: 'correct',
        completed: true,
      });
      expect(att2.attemptNumber).toBe(2);

      const metrics = await service.getActivityMetrics('student_1', 'Q001');
      expect(metrics.attempts).toBe(2);
      expect(metrics.correctAttempts).toBe(1);
      expect(metrics.incorrectAttempts).toBe(1);
      expect(metrics.retryCount).toBe(1);
      expect(metrics.firstAttemptCorrect).toBe(false);
      expect(metrics.eventuallyCorrect).toBe(true);
      expect(metrics.completed).toBe(true);
    });

    it('tracks incorrect -> incorrect -> correct (retryCount = 2)', async () => {
      const service = new AttemptService(new LocalAttemptRepository());

      // Attempt 1: Incorrect
      await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'Q002',
        result: 'incorrect',
        completed: false,
      });

      // Attempt 2: Incorrect
      await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'Q002',
        result: 'incorrect',
        completed: false,
      });

      // Attempt 3: Correct
      await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'Q002',
        result: 'correct',
        completed: true,
      });

      const metrics = await service.getActivityMetrics('student_1', 'Q002');
      expect(metrics.attempts).toBe(3);
      expect(metrics.correctAttempts).toBe(1);
      expect(metrics.incorrectAttempts).toBe(2);
      expect(metrics.retryCount).toBe(2);
      expect(metrics.firstAttemptCorrect).toBe(false);
      expect(metrics.eventuallyCorrect).toBe(true);
      expect(metrics.completed).toBe(true);
    });
  });

  describe('Multiple activities & Multiple students', () => {
    it('isolates attempts across multiple activities for the same student', async () => {
      const service = new AttemptService(new LocalAttemptRepository());

      await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'ACT_A',
        result: 'incorrect',
        completed: false,
      });
      await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'ACT_A',
        result: 'correct',
        completed: true,
      });

      await service.recordAttempt({
        studentId: 'student_1',
        activityId: 'ACT_B',
        result: 'correct',
        completed: true,
      });

      const metricsA = await service.getActivityMetrics('student_1', 'ACT_A');
      expect(metricsA.attempts).toBe(2);
      expect(metricsA.retryCount).toBe(1);

      const metricsB = await service.getActivityMetrics('student_1', 'ACT_B');
      expect(metricsB.attempts).toBe(1);
      expect(metricsB.retryCount).toBe(0);
    });

    it('isolates attempts across multiple students for the same activity', async () => {
      const service = new AttemptService(new LocalAttemptRepository());

      // Student A fails once, then succeeds
      await service.recordAttempt({
        studentId: 'student_A',
        activityId: 'Q100',
        result: 'incorrect',
        completed: false,
      });
      await service.recordAttempt({
        studentId: 'student_A',
        activityId: 'Q100',
        result: 'correct',
        completed: true,
      });

      // Student B attempts same activity and succeeds on first try
      await service.recordAttempt({
        studentId: 'student_B',
        activityId: 'Q100',
        result: 'correct',
        completed: true,
      });

      const metricsA = await service.getActivityMetrics('student_A', 'Q100');
      expect(metricsA.attempts).toBe(2);
      expect(metricsA.retryCount).toBe(1);

      const metricsB = await service.getActivityMetrics('student_B', 'Q100');
      expect(metricsB.attempts).toBe(1);
      expect(metricsB.retryCount).toBe(0);
      expect(metricsB.firstAttemptCorrect).toBe(true);
    });

    it('deletes attempts for one student without affecting another student', async () => {
      const service = new AttemptService(new LocalAttemptRepository());

      await service.recordAttempt({
        studentId: 'student_A',
        activityId: 'Q1',
        result: 'correct',
        completed: true,
      });
      await service.recordAttempt({
        studentId: 'student_B',
        activityId: 'Q1',
        result: 'correct',
        completed: true,
      });

      await service.deleteStudentAttempts('student_B');

      const attemptsA = await service.getAttempts('student_A');
      expect(attemptsA.length).toBe(1);

      const attemptsB = await service.getAttempts('student_B');
      expect(attemptsB.length).toBe(0);
    });
  });

  describe('Resilience', () => {
    it('handles corrupted JSON in attempts storage gracefully', async () => {
      store[ATTEMPTS_STORAGE_KEY_V1] = 'invalid JSON text {{{';

      const service = new AttemptService(new LocalAttemptRepository());
      const attempts = await service.getAttempts('student_1');
      expect(attempts).toEqual([]);
    });

    it('handles storage write failure gracefully', async () => {
      const repo = new LocalAttemptRepository();
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      });

      await expect(
        repo.saveAttempt({
          id: 'att_1',
          studentId: 's1',
          activityId: 'act_1',
          attemptNumber: 1,
          result: 'correct',
          completed: true,
          timestamp: new Date().toISOString(),
        })
      ).resolves.not.toThrow();
    });
  });
});
