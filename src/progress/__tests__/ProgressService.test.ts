import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressService } from '../ProgressService';
import { ProgressRepository } from '../ProgressRepository';
import { ActivityProgress, CategoryProgress, ProgressSummary } from '../types';
import { ActivityResult } from '../../engine/types';
import { ActivityCategory } from '../../types';

// ---------------------------------------------------------------------------
// In-memory stub repository
// ---------------------------------------------------------------------------
class StubProgressRepository implements ProgressRepository {
  private store: Record<string, ActivityProgress> = {};

  async getActivityProgress(activityId: string) {
    return this.store[activityId] ?? null;
  }

  async saveActivityProgress(progress: ActivityProgress) {
    this.store[progress.activityId] = progress;
  }

  async getAllProgress() {
    return { ...this.store };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSummary(_opts: { availableCountByCategory: Record<ActivityCategory, number> }): Promise<ProgressSummary> {
    const all = Object.values(this.store);
    return {
      totalActivities: 0,
      totalCompleted: all.filter(p => p.completed).length,
      totalCorrect: all.filter(p => p.correct).length,
      accuracy: 0,
      byCategory: [],
    };
  }

  async getCategoryProgress(category: ActivityCategory, totalInCategory: number): Promise<CategoryProgress> {
    const all = Object.values(this.store).filter(p => p.category === category);
    return {
      category,
      total: totalInCategory,
      completed: all.filter(p => p.completed).length,
      correct: all.filter(p => p.correct).length,
    };
  }

  async clearProgress() {
    this.store = {};
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProgressService', () => {
  let repo: StubProgressRepository;
  let service: ProgressService;

  beforeEach(() => {
    repo = new StubProgressRepository();
    service = new ProgressService(repo);
  });

  it('does not save incomplete activity results', async () => {
    const result: ActivityResult = {
      activityId: 'Q001',
      completed: false,
      correct: false,
      attempts: 1,
      startedAt: Date.now(),
    };
    await service.recordCompletion(result, 'spelling-choice');
    const progress = await service.getActivityProgress('Q001');
    expect(progress).toBeNull();
  });

  it('saves a correct completion', async () => {
    const result: ActivityResult = {
      activityId: 'Q001',
      completed: true,
      correct: true,
      attempts: 1,
      startedAt: Date.now(),
      completedAt: Date.now(),
    };
    await service.recordCompletion(result, 'spelling-choice');
    const progress = await service.getActivityProgress('Q001');
    expect(progress).not.toBeNull();
    expect(progress!.correct).toBe(true);
    expect(progress!.completed).toBe(true);
    expect(progress!.category).toBe('spelling-choice');
  });

  it('saves an incorrect completion', async () => {
    const result: ActivityResult = {
      activityId: 'Q002',
      completed: true,
      correct: false,
      attempts: 2,
      startedAt: Date.now(),
    };
    await service.recordCompletion(result, 'arrange-word');
    const progress = await service.getActivityProgress('Q002');
    expect(progress!.correct).toBe(false);
    expect(progress!.attempts).toBe(2);
  });

  it('clears progress', async () => {
    const result: ActivityResult = {
      activityId: 'Q001',
      completed: true,
      correct: true,
      attempts: 1,
      startedAt: Date.now(),
    };
    await service.recordCompletion(result, 'meaning-match');
    await service.clearProgress();
    const progress = await service.getActivityProgress('Q001');
    expect(progress).toBeNull();
  });

  it('returns null for unknown activityId', async () => {
    const progress = await service.getActivityProgress('nonexistent-id');
    expect(progress).toBeNull();
  });

  it('returns category progress', async () => {
    await service.recordCompletion(
      { activityId: 'Q001', completed: true, correct: true, attempts: 1, startedAt: Date.now() },
      'picture-recognition'
    );
    const catProgress = await service.getCategoryProgress('picture-recognition', 21);
    expect(catProgress.completed).toBe(1);
    expect(catProgress.total).toBe(21);
  });

  it('getSummary reflects all recordings', async () => {
    await service.recordCompletion(
      { activityId: 'Q001', completed: true, correct: true, attempts: 1, startedAt: Date.now() },
      'spelling-choice'
    );
    await service.recordCompletion(
      { activityId: 'Q002', completed: true, correct: false, attempts: 1, startedAt: Date.now() },
      'arrange-word'
    );
    const summary = await service.getSummary({ availableCountByCategory: {} as Record<ActivityCategory, number> });
    expect(summary.totalCompleted).toBe(2);
    expect(summary.totalCorrect).toBe(1);
  });
});
