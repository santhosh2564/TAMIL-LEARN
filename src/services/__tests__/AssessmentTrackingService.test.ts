import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AssessmentTrackingService,
  resolveQuestionId,
  resolveModuleId,
} from '../AssessmentTrackingService';
import { AssessmentOutboxQueue, QueuedQuestionAttempt } from '../AssessmentOutboxQueue';
import { Activity } from '../../types';

describe('AssessmentTrackingService & Canonical Identity Resolution', () => {
  let mockOutbox: AssessmentOutboxQueue;
  let service: AssessmentTrackingService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockOutbox = new AssessmentOutboxQueue();
    service = new AssessmentTrackingService(mockOutbox);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Question Identity & Module Resolution', () => {
    it('resolves Tamil questions using source.questionId, falling back to activity.id', () => {
      const tamilWithQId = {
        id: 'FTS0042',
        subject: 'Tamil',
        source: { workbook: 'wb.xlsx', questionId: 'FTS0042' },
      } as Activity;
      expect(resolveQuestionId(tamilWithQId)).toBe('FTS0042');

      const tamilFallback = {
        id: 'Q099',
        subject: 'tamil',
        source: { workbook: 'wb.xlsx' },
      } as Activity;
      expect(resolveQuestionId(tamilFallback)).toBe('Q099');
    });

    it('resolves English questions using source.ewId, preserving canonical word identity', () => {
      const englishAct = {
        id: 'ENG-M1-EW021',
        subject: 'English',
        source: { workbook: 'wb.xlsx', ewId: 'EW021' },
      } as Activity;
      expect(resolveQuestionId(englishAct)).toBe('EW021');

      const englishFallback = {
        id: 'ENG-M3-CUSTOM',
        subject: 'english',
        source: { workbook: 'wb.xlsx' },
      } as Activity;
      expect(resolveQuestionId(englishFallback)).toBe('ENG-M3-CUSTOM');
    });

    it('preserves module IDs across repeated English review questions', () => {
      const m1Activity = {
        id: 'ENG-M1-EW021',
        subject: 'English',
        module: 1,
        source: { ewId: 'EW021' },
      } as Activity;

      const m2ReviewActivity = {
        id: 'ENG-M2-EW021',
        subject: 'English',
        module: 2,
        role: 'review',
        source: { ewId: 'EW021' },
      } as Activity;

      expect(resolveQuestionId(m1Activity)).toBe('EW021');
      expect(resolveQuestionId(m2ReviewActivity)).toBe('EW021');
      expect(resolveModuleId(m1Activity)).toBe(1);
      expect(resolveModuleId(m2ReviewActivity)).toBe(2);
    });

    it('verifies question resolution across all six activity categories', () => {
      const categories = [
        { cat: 'picture-recognition', sub: 'Tamil', qId: 'FTS0101' },
        { cat: 'spelling-choice', sub: 'English', ewId: 'EW102' },
        { cat: 'meaning-match', sub: 'Tamil', qId: 'FTS0103' },
        { cat: 'context-choice', sub: 'Tamil', qId: 'FTS0104' },
        { cat: 'arrange-word', sub: 'Tamil', qId: 'FTS0105' },
        { cat: 'word-completion', sub: 'English', ewId: 'EW106' },
      ] as const;

      for (const item of categories) {
        const act = {
          id: `act_${item.cat}`,
          category: item.cat,
          subject: item.sub,
          source: item.sub === 'English' ? { ewId: item.ewId } : { questionId: item.qId },
        } as unknown as Activity;

        const expected = item.sub === 'English' ? item.ewId : item.qId;
        expect(resolveQuestionId(act)).toBe(expected);
      }
    });
  });

  describe('Monotonic Attempt Numbering & Immutable History', () => {
    it('records sequence: incorrect -> incorrect -> correct as attempts 1, 2, and 3', async () => {
      const sessionId = 'sess_flow_123';
      const studentId = 'stud_flow_123';
      const activity = {
        id: 'FTS0001',
        subject: 'Tamil',
        module: 1,
        category: 'spelling-choice',
        source: { questionId: 'FTS0001' },
      } as Activity;

      // Mock fetch success
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ status: 'recorded' }),
      } as Response);

      // Attempt 1: Incorrect
      const r1 = await service.recordSubmission({
        studentId,
        sessionId,
        activity,
        input: 'wrong1',
        isCorrect: false,
        isCompleted: false,
      });
      expect(r1.attemptNumber).toBe(1);
      expect(r1.questionId).toBe('FTS0001');

      // Attempt 2: Incorrect
      const r2 = await service.recordSubmission({
        studentId,
        sessionId,
        activity,
        input: 'wrong2',
        isCorrect: false,
        isCompleted: false,
      });
      expect(r2.attemptNumber).toBe(2);

      // Attempt 3: Correct
      const r3 = await service.recordSubmission({
        studentId,
        sessionId,
        activity,
        input: 'correct',
        isCorrect: true,
        isCompleted: true,
      });
      expect(r3.attemptNumber).toBe(3);

      // Verify each attempt generated a unique submission ID and idempotency key
      expect(r1.submissionId).not.toBe(r2.submissionId);
      expect(r2.submissionId).not.toBe(r3.submissionId);
      expect(r1.idempotencyKey).not.toBe(r2.idempotencyKey);
      expect(r2.idempotencyKey).not.toBe(r3.idempotencyKey);
    });

    it('resets attempt numbering for a different question in the same session', async () => {
      const sessionId = 'sess_mult_q';
      const studentId = 'stud_123';

      const q1 = {
        id: 'FTS0001',
        subject: 'Tamil',
        source: { questionId: 'FTS0001' },
      } as Activity;

      const q2 = {
        id: 'FTS0002',
        subject: 'Tamil',
        source: { questionId: 'FTS0002' },
      } as Activity;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      } as Response);

      const r1 = await service.recordSubmission({
        studentId,
        sessionId,
        activity: q1,
        input: 'wrong',
        isCorrect: false,
        isCompleted: false,
      });
      expect(r1.attemptNumber).toBe(1);

      const r2 = await service.recordSubmission({
        studentId,
        sessionId,
        activity: q2,
        input: 'correct',
        isCorrect: true,
        isCompleted: true,
      });
      expect(r2.attemptNumber).toBe(1);
    });
  });

  describe('Offline Persistence & Resilient Outbox Queue', () => {
    it('retains attempt in outbox when offline and flushes when online', async () => {
      const outbox = new AssessmentOutboxQueue();
      const customService = new AssessmentTrackingService(outbox);

      const studentId = 'stud_offline';
      const sessionId = 'sess_offline';
      const activity = {
        id: 'ENG-M1-EW021',
        subject: 'English',
        source: { ewId: 'EW021' },
      } as Activity;

      // Simulate network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const result = await customService.recordSubmission({
        studentId,
        sessionId,
        activity,
        input: 'ask',
        isCorrect: true,
        isCompleted: true,
      });

      expect(result.synced).toBe(false);

      // Verify attempt is securely enqueued in outbox
      const pending = await outbox.getAll();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(result.submissionId);
      expect(pending[0].idempotencyKey).toBe(result.idempotencyKey);
      expect(pending[0].questionId).toBe('EW021');

      // Simulate connectivity restored
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ status: 'recorded' }),
      } as Response);

      const flushResult = await outbox.flush(studentId);
      expect(flushResult.flushed).toBe(1);
      expect(flushResult.remaining).toBe(0);

      // Outbox must now be empty
      const afterFlush = await outbox.getAll();
      expect(afterFlush.length).toBe(0);
    });

    it('preserves attempt counts across browser refresh using persistent storage', () => {
      const sessionId = 'sess_refresh_test';
      const questionId = 'Q123';

      const s1 = new AssessmentTrackingService();
      // Record attempt 1 & 2
      const num1 = s1.incrementAttemptNumber(sessionId, questionId);
      const num2 = s1.incrementAttemptNumber(sessionId, questionId);
      expect(num1).toBe(1);
      expect(num2).toBe(2);

      // Create new service instance simulating page reload
      const s2 = new AssessmentTrackingService();
      const current = s2.getAttemptNumber(sessionId, questionId);
      expect(current).toBe(2);

      const next = s2.incrementAttemptNumber(sessionId, questionId);
      expect(next).toBe(3);
    });

    it('recovers attempt number from pending outbox items if local attemptCounts storage was cleared', async () => {
      const outbox = new AssessmentOutboxQueue();
      const sessionId = 'sess_outbox_refresh';
      const questionId = 'EW999';

      // Simulate an un-flushed attempt in the outbox
      await outbox.enqueue({
        id: 'att_unflushed',
        sessionId,
        studentId: 'stud_1',
        subjectId: 'english',
        moduleId: 1,
        activityId: 'ENG-M1-EW999',
        questionId,
        answerPayload: { answer: 'bad' },
        isCorrect: false,
        isCompleted: false,
        attemptedAt: new Date().toISOString(),
        idempotencyKey: 'idem_unflushed',
        attemptNumber: 4,
      });

      // Clear attemptCounts storage specifically
      sessionStorage.clear();
      localStorage.removeItem(`sa.assessment.attemptCounts.${sessionId}`);

      const service = new AssessmentTrackingService(outbox);
      // It should recover that attempt 4 was already made
      expect(service.getAttemptNumber(sessionId, questionId)).toBe(4);
      // The next attempt must be 5
      expect(service.incrementAttemptNumber(sessionId, questionId)).toBe(5);
    });

    it('isolates student attempts during outbox flush', async () => {
      const outbox = new AssessmentOutboxQueue();

      const itemA: QueuedQuestionAttempt = {
        id: 'att_a',
        sessionId: 'sess_a',
        studentId: 'student_a',
        subjectId: 'tamil',
        moduleId: 1,
        activityId: 'FTS0001',
        questionId: 'FTS0001',
        answerPayload: { answer: 'A' },
        isCorrect: true,
        isCompleted: true,
        attemptedAt: new Date().toISOString(),
        idempotencyKey: 'idem_a',
        attemptNumber: 1,
      };

      const itemB: QueuedQuestionAttempt = {
        id: 'att_b',
        sessionId: 'sess_b',
        studentId: 'student_b',
        subjectId: 'tamil',
        moduleId: 1,
        activityId: 'FTS0002',
        questionId: 'FTS0002',
        answerPayload: { answer: 'B' },
        isCorrect: true,
        isCompleted: true,
        attemptedAt: new Date().toISOString(),
        idempotencyKey: 'idem_b',
        attemptNumber: 1,
      };

      await outbox.enqueue(itemA);
      await outbox.enqueue(itemB);

      expect(await outbox.size()).toBe(2);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      } as Response);

      // Flush only for student_a
      const flushResult = await outbox.flush('student_a');
      expect(flushResult.flushed).toBe(1);
      expect(flushResult.remaining).toBe(1);

      // student_b's item must remain safely queued
      const remainingItems = await outbox.getAll();
      expect(remainingItems.length).toBe(1);
      expect(remainingItems[0].studentId).toBe('student_b');
    });
  });
});
