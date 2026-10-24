import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalProgressRepository, PROGRESS_STORAGE_KEY_V2 } from '../LocalProgressRepository';
import { ProgressService } from '../ProgressService';
import { ActivityProgress } from '../types';

describe('Student Progress Isolation', () => {
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

  function makeProgress(overrides: Partial<ActivityProgress> = {}): ActivityProgress {
    return {
      activityId: 'Q001',
      category: 'picture-recognition',
      completed: true,
      correct: true,
      attempts: 1,
      lastCompletedAt: new Date().toISOString(),
      lastAttemptedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('Student A completes Q001; Student B must see Q001 = not completed', async () => {
    const repo = new LocalProgressRepository(PROGRESS_STORAGE_KEY_V2);
    const service = new ProgressService(repo);

    const studentAId = 'student-arjun-id';
    const studentBId = 'student-priya-id';

    // Student A completes Q001
    await service.recordCompletion(
      {
        activityId: 'Q001',
        completed: true,
        correct: true,
        attempts: 1,
        startedAt: Date.now(),
        completedAt: Date.now(),
      },
      'picture-recognition',
      studentAId
    );

    // Verify Student A sees Q001 completed
    const progressA = await service.getActivityProgress('Q001', studentAId);
    expect(progressA).not.toBeNull();
    expect(progressA!.completed).toBe(true);
    expect(progressA!.correct).toBe(true);

    // Verify Student B sees Q001 as null / not completed
    const progressB = await service.getActivityProgress('Q001', studentBId);
    expect(progressB).toBeNull();
  });

  it('Student A has 10 completed activities; Student B starts with 0 completed', async () => {
    const repo = new LocalProgressRepository(PROGRESS_STORAGE_KEY_V2);
    const service = new ProgressService(repo);

    const studentAId = 'student-arjun-id';
    const studentBId = 'student-priya-id';

    // Student A completes 10 activities (Q001 to Q010)
    for (let i = 1; i <= 10; i++) {
      const activityId = `Q${String(i).padStart(3, '0')}`;
      await service.recordCompletion(
        {
          activityId,
          completed: true,
          correct: true,
          attempts: 1,
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
        'spelling-choice',
        studentAId
      );
    }

    const availableCategories = {
      'spelling-choice': 20,
      'picture-recognition': 20,
      'word-completion': 20,
      'arrange-word': 20,
      'context-choice': 20,
      'meaning-match': 20,
    };

    // Student A summary
    const summaryA = await service.getSummary({ availableCountByCategory: availableCategories }, studentAId);
    expect(summaryA.totalCompleted).toBe(10);
    expect(summaryA.totalCorrect).toBe(10);

    // Student B summary must be completely 0
    const summaryB = await service.getSummary({ availableCountByCategory: availableCategories }, studentBId);
    expect(summaryB.totalCompleted).toBe(0);
    expect(summaryB.totalCorrect).toBe(0);

    // Student B category progress must also be 0
    const catProgressB = await service.getCategoryProgress('spelling-choice', 20, studentBId);
    expect(catProgressB.completed).toBe(0);

    const catProgressA = await service.getCategoryProgress('spelling-choice', 20, studentAId);
    expect(catProgressA.completed).toBe(10);
  });

  it('Deleting Student B does not affect Student A data', async () => {
    const repo = new LocalProgressRepository(PROGRESS_STORAGE_KEY_V2);
    const service = new ProgressService(repo);

    const studentAId = 'student-arjun-id';
    const studentBId = 'student-priya-id';

    // Seed progress for both
    await service.recordCompletion(
      { activityId: 'Q001', completed: true, correct: true, attempts: 1, startedAt: Date.now() },
      'meaning-match',
      studentAId
    );
    await service.recordCompletion(
      { activityId: 'Q001', completed: true, correct: true, attempts: 1, startedAt: Date.now() },
      'meaning-match',
      studentBId
    );

    // Delete student B's data
    await service.deleteStudentData(studentBId);

    // Student B is gone
    const progressB = await service.getActivityProgress('Q001', studentBId);
    expect(progressB).toBeNull();

    // Student A remains intact
    const progressA = await service.getActivityProgress('Q001', studentAId);
    expect(progressA).not.toBeNull();
    expect(progressA?.completed).toBe(true);
  });

  it('Clearing Student A progress does not affect Student B', async () => {
    const repo = new LocalProgressRepository(PROGRESS_STORAGE_KEY_V2);
    const service = new ProgressService(repo);

    const studentAId = 'student-arjun-id';
    const studentBId = 'student-priya-id';

    await service.recordCompletion(
      { activityId: 'ACT_1', completed: true, correct: true, attempts: 1, startedAt: Date.now() },
      'arrange-word',
      studentAId
    );
    await service.recordCompletion(
      { activityId: 'ACT_2', completed: true, correct: true, attempts: 1, startedAt: Date.now() },
      'arrange-word',
      studentBId
    );

    // Clear only student A
    await service.clearProgress(studentAId);

    expect(await service.getActivityProgress('ACT_1', studentAId)).toBeNull();

    const progB = await service.getActivityProgress('ACT_2', studentBId);
    expect(progB).not.toBeNull();
    expect(progB?.completed).toBe(true);
  });

  it('Legacy unscoped v1 progress does not contaminate student-scoped queries', async () => {
    const repo = new LocalProgressRepository(PROGRESS_STORAGE_KEY_V2);
    const service = new ProgressService(repo);

    // Suppose an old unscoped v1 snapshot exists in storage
    store[PROGRESS_STORAGE_KEY_V2] = JSON.stringify({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      activities: {
        Q001: makeProgress({ activityId: 'Q001', completed: true }),
      },
    });

    // Querying for a new student must NOT return the old unscoped progress
    const studentProgress = await service.getActivityProgress('Q001', 'new-student-id');
    expect(studentProgress).toBeNull();
  });
});
