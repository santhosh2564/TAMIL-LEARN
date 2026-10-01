import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalProgressRepository, STORAGE_KEY } from '../LocalProgressRepository';
import { ActivityProgress, PROGRESS_SCHEMA_VERSION } from '../types';

// ---------------------------------------------------------------------------
// Minimal localStorage mock
// ---------------------------------------------------------------------------
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};

vi.stubGlobal('localStorage', localStorageMock);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeProgress(overrides: Partial<ActivityProgress> = {}): ActivityProgress {
  return {
    activityId: 'Q001',
    category: 'spelling-choice',
    completed: true,
    correct: true,
    attempts: 1,
    lastCompletedAt: '2026-10-01T00:00:00.000Z',
    lastAttemptedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('LocalProgressRepository', () => {
  let repo: LocalProgressRepository;

  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    repo = new LocalProgressRepository();
  });

  // -------------------------------------------------------------------------
  // SAVE + READ
  // -------------------------------------------------------------------------

  it('returns null for unknown activityId', async () => {
    const result = await repo.getActivityProgress('Q999');
    expect(result).toBeNull();
  });

  it('saves and reads back a progress record', async () => {
    const p = makeProgress();
    await repo.saveActivityProgress(p);
    const read = await repo.getActivityProgress('Q001');
    expect(read).not.toBeNull();
    expect(read!.activityId).toBe('Q001');
    expect(read!.correct).toBe(true);
  });

  it('merges attempts on re-save', async () => {
    await repo.saveActivityProgress(makeProgress({ attempts: 2 }));
    await repo.saveActivityProgress(makeProgress({ attempts: 3 }));
    const read = await repo.getActivityProgress('Q001');
    expect(read!.attempts).toBe(5); // 2 + 3
  });

  it('retains ever-correct state across updates', async () => {
    await repo.saveActivityProgress(makeProgress({ correct: true }));
    await repo.saveActivityProgress(makeProgress({ correct: false }));
    const read = await repo.getActivityProgress('Q001');
    expect(read!.correct).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CLEAR
  // -------------------------------------------------------------------------

  it('clears all progress', async () => {
    await repo.saveActivityProgress(makeProgress());
    await repo.clearProgress();
    const read = await repo.getActivityProgress('Q001');
    expect(read).toBeNull();
  });

  // -------------------------------------------------------------------------
  // RESILIENCE
  // -------------------------------------------------------------------------

  it('returns empty progress for empty storage', async () => {
    const all = await repo.getAllProgress();
    expect(all).toEqual({});
  });

  it('returns empty progress for malformed JSON', async () => {
    store[STORAGE_KEY] = 'not-valid-json{{{{';
    const all = await repo.getAllProgress();
    expect(all).toEqual({});
  });

  it('returns empty progress for unsupported schema version', async () => {
    store[STORAGE_KEY] = JSON.stringify({
      version: 999,
      updatedAt: '2026-01-01T00:00:00.000Z',
      activities: { Q001: makeProgress() }
    });
    const all = await repo.getAllProgress();
    expect(all).toEqual({});
  });

  it('returns empty progress when storage key is missing', async () => {
    const all = await repo.getAllProgress();
    expect(all).toEqual({});
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------

  it('returns correct summary with real data', async () => {
    await repo.saveActivityProgress(makeProgress({ activityId: 'Q001', category: 'spelling-choice', correct: true }));
    await repo.saveActivityProgress(makeProgress({ activityId: 'Q002', category: 'arrange-word', correct: false }));
    
    const summary = await repo.getSummary({
      availableCountByCategory: {
        'spelling-choice': 26,
        'arrange-word': 38,
        'picture-recognition': 21,
        'word-completion': 9,
        'context-choice': 27,
        'meaning-match': 23,
      }
    });
    
    expect(summary.totalCompleted).toBe(2);
    expect(summary.totalCorrect).toBe(1);
    expect(summary.totalActivities).toBe(144);
    expect(summary.accuracy).toBe(50);
  });

  it('getCategoryProgress returns zero for empty category', async () => {
    const catProg = await repo.getCategoryProgress('picture-recognition', 21);
    expect(catProg.completed).toBe(0);
    expect(catProg.total).toBe(21);
  });

  it('schema version constant matches expected value', () => {
    expect(PROGRESS_SCHEMA_VERSION).toBe(1);
  });
});
