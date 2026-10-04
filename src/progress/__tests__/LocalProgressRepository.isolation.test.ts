import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LocalProgressRepository,
  DEFAULT_TAMIL_STORAGE_KEY,
  ENGLISH_STORAGE_KEY,
} from '../LocalProgressRepository';
import { ActivityProgress } from '../types';

// ---------------------------------------------------------------------------
// In-memory localStorage mock
// ---------------------------------------------------------------------------
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
};

vi.stubGlobal('localStorage', localStorageMock);

function makeProgress(overrides: Partial<ActivityProgress> = {}): ActivityProgress {
  return {
    activityId: 'ACT_001',
    category: 'spelling-choice',
    completed: true,
    correct: true,
    attempts: 1,
    firstAttemptCorrect: true,
    finalCorrect: true,
    lastCompletedAt: '2026-10-04T00:00:00.000Z',
    lastAttemptedAt: '2026-10-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('Storage Isolation: Tamil key vs English key', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it('verifies that Tamil and English storage keys are distinct constants', () => {
    expect(DEFAULT_TAMIL_STORAGE_KEY).toBe('sa.learning.progress.v1');
    expect(ENGLISH_STORAGE_KEY).toBe('sa.learning.progress.english.v1');
    expect(DEFAULT_TAMIL_STORAGE_KEY).not.toBe(ENGLISH_STORAGE_KEY);
  });

  it('default repository instance targets Tamil storage key', async () => {
    const defaultRepo = new LocalProgressRepository();
    await defaultRepo.saveActivityProgress(makeProgress({ activityId: 'T_001' }));

    expect(store[DEFAULT_TAMIL_STORAGE_KEY]).toBeDefined();
    expect(store[ENGLISH_STORAGE_KEY]).toBeUndefined();
  });

  it('saving English progress writes only to English storage key and never mutates Tamil', async () => {
    const tamilRepo = new LocalProgressRepository(DEFAULT_TAMIL_STORAGE_KEY);
    const englishRepo = new LocalProgressRepository(ENGLISH_STORAGE_KEY);

    // Initial Tamil state
    await tamilRepo.saveActivityProgress(makeProgress({ activityId: 'TAMIL_ACT_1' }));
    const initialTamilRaw = store[DEFAULT_TAMIL_STORAGE_KEY];
    expect(initialTamilRaw).toBeDefined();

    // Now write to English repo
    await englishRepo.saveActivityProgress(
      makeProgress({ activityId: 'ENG_ACT_1', category: 'spelling-choice' })
    );

    // Assert English storage is populated
    expect(store[ENGLISH_STORAGE_KEY]).toBeDefined();
    const englishParsed = JSON.parse(store[ENGLISH_STORAGE_KEY]);
    expect(englishParsed.activities['ENG_ACT_1']).toBeDefined();
    expect(englishParsed.activities['TAMIL_ACT_1']).toBeUndefined();

    // Assert Tamil storage was NOT mutated at all
    expect(store[DEFAULT_TAMIL_STORAGE_KEY]).toBe(initialTamilRaw);
    const tamilParsed = JSON.parse(store[DEFAULT_TAMIL_STORAGE_KEY]);
    expect(tamilParsed.activities['TAMIL_ACT_1']).toBeDefined();
    expect(tamilParsed.activities['ENG_ACT_1']).toBeUndefined();
  });

  it('clearing English progress does not mutate or erase Tamil progress', async () => {
    const tamilRepo = new LocalProgressRepository(DEFAULT_TAMIL_STORAGE_KEY);
    const englishRepo = new LocalProgressRepository(ENGLISH_STORAGE_KEY);

    // Seed both
    await tamilRepo.saveActivityProgress(makeProgress({ activityId: 'T_01' }));
    await englishRepo.saveActivityProgress(makeProgress({ activityId: 'E_01' }));

    expect(store[DEFAULT_TAMIL_STORAGE_KEY]).toBeDefined();
    expect(store[ENGLISH_STORAGE_KEY]).toBeDefined();

    // Clear English only
    await englishRepo.clearProgress();

    expect(store[ENGLISH_STORAGE_KEY]).toBeUndefined();
    expect(store[DEFAULT_TAMIL_STORAGE_KEY]).toBeDefined();

    const tamilRemaining = await tamilRepo.getActivityProgress('T_01');
    expect(tamilRemaining).not.toBeNull();
    expect(tamilRemaining?.activityId).toBe('T_01');

    const englishCleared = await englishRepo.getActivityProgress('E_01');
    expect(englishCleared).toBeNull();
  });

  it('clearing Tamil progress does not mutate or erase English progress', async () => {
    const tamilRepo = new LocalProgressRepository(DEFAULT_TAMIL_STORAGE_KEY);
    const englishRepo = new LocalProgressRepository(ENGLISH_STORAGE_KEY);

    // Seed both
    await tamilRepo.saveActivityProgress(makeProgress({ activityId: 'T_02' }));
    await englishRepo.saveActivityProgress(makeProgress({ activityId: 'E_02' }));

    // Clear Tamil only
    await tamilRepo.clearProgress();

    expect(store[DEFAULT_TAMIL_STORAGE_KEY]).toBeUndefined();
    expect(store[ENGLISH_STORAGE_KEY]).toBeDefined();

    const englishRemaining = await englishRepo.getActivityProgress('E_02');
    expect(englishRemaining).not.toBeNull();
    expect(englishRemaining?.activityId).toBe('E_02');

    const tamilCleared = await tamilRepo.getActivityProgress('T_02');
    expect(tamilCleared).toBeNull();
  });
});
