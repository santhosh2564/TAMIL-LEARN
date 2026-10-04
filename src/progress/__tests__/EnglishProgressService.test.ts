import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnglishProgressService } from '../EnglishProgressService';
import { LocalProgressRepository, ENGLISH_STORAGE_KEY } from '../LocalProgressRepository';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { Activity } from '../../types';
import { ActivityResult } from '../../engine/types';

// Mock localStorage in-memory
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

function makeResult(overrides: Partial<ActivityResult> & { activityId: string }): ActivityResult {
  return {
    completed: true,
    correct: true,
    attempts: 1,
    startedAt: 1000,
    completedAt: 2000,
    ...overrides,
  };
}

describe('EnglishProgressService', () => {
  let service: EnglishProgressService;
  let repo: LocalProgressRepository;
  let contentRepo: LocalContentRepository;

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    repo = new LocalProgressRepository(ENGLISH_STORAGE_KEY);
    contentRepo = new LocalContentRepository();
    service = new EnglishProgressService(repo, contentRepo);
  });

  describe('1. Activity Completion & Attempt Accuracy Tracking', () => {
    it('records first-attempt success: attempts === 1 and correct: true', async () => {
      const mockAct: Activity = {
        id: 'c3_eng_m1_d1_01_e08',
        classLevel: 3,
        language: 'en',
        level: 1,
        term: '1',
        subject: 'English',
        category: 'meaning-match',
        variant: 'word-entry',
        prompt: 'Type the word',
        targetWord: 'actor',
        correctAnswer: 'actor',
        role: 'new',
        module: 1,
        day: 1,
        source: { ewId: 'EW001', workbook: 'module-1' },
      };

      const result = makeResult({
        activityId: 'c3_eng_m1_d1_01_e08',
        completed: true,
        correct: true,
        attempts: 1,
      });

      await service.recordActivityCompletion(result, mockAct);
      const prog = await service.getActivityProgress('c3_eng_m1_d1_01_e08');

      expect(prog).not.toBeNull();
      expect(prog?.completed).toBe(true);
      expect(prog?.firstAttemptCorrect).toBe(true);
      expect(prog?.finalCorrect).toBe(true);
      expect(prog?.attempts).toBe(1);
    });

    it('records retry success: attempts === 2 and correct: true', async () => {
      const mockAct: Activity = {
        id: 'c3_eng_m1_d1_02_e05',
        classLevel: 3,
        language: 'en',
        level: 1,
        term: '1',
        subject: 'English',
        category: 'word-completion',
        variant: 'word-entry',
        prompt: 'Fill missing letter',
        targetWord: 'about',
        correctAnswer: 'o',
        role: 'new',
        module: 1,
        day: 1,
        source: { ewId: 'EW002', workbook: 'module-1' },
      };

      const result = makeResult({
        activityId: 'c3_eng_m1_d1_02_e05',
        completed: true,
        correct: true,
        attempts: 2, // Retried after 1 failure
      });

      await service.recordActivityCompletion(result, mockAct);
      const prog = await service.getActivityProgress('c3_eng_m1_d1_02_e05');

      expect(prog).not.toBeNull();
      expect(prog?.completed).toBe(true);
      expect(prog?.firstAttemptCorrect).toBe(false);
      expect(prog?.finalCorrect).toBe(true);
      expect(prog?.attempts).toBe(2);
    });
  });

  describe('2. Day Progress Calculation', () => {
    it('returns empty progress for day with 0 completed activities', async () => {
      const dayProg = await service.getDayProgress(1, 1);
      expect(dayProg.module).toBe(1);
      expect(dayProg.day).toBe(1);
      expect(dayProg.totalActivities).toBe(24);
      expect(dayProg.completedActivities).toBe(0);
      expect(dayProg.percent).toBe(0);
      expect(dayProg.isCompleted).toBe(false);
    });

    it('returns partial progress when some activities are completed (e.g. 18 / 24)', async () => {
      const m1d1Activities = await contentRepo.getActivities({
        subject: 'English',
        module: 1,
        day: 1,
      });
      expect(m1d1Activities.length).toBe(24);

      // Complete 18 activities
      for (let i = 0; i < 18; i++) {
        await service.recordActivityCompletion(
          makeResult({
            activityId: m1d1Activities[i].id,
            completed: true,
            correct: true,
            attempts: i % 2 === 0 ? 1 : 2, // Half first-try, half retry
          }),
          m1d1Activities[i]
        );
      }

      const dayProg = await service.getDayProgress(1, 1);
      expect(dayProg.completedActivities).toBe(18);
      expect(dayProg.totalActivities).toBe(24);
      expect(dayProg.percent).toBe(75);
      expect(dayProg.isCompleted).toBe(false); // Incomplete
      expect(dayProg.firstTryAccuracy).toBe(50); // 9 / 18
    });

    it('marks day as complete when all activities are completed (24 / 24)', async () => {
      const m1d1Activities = await contentRepo.getActivities({
        subject: 'English',
        module: 1,
        day: 1,
      });

      for (const act of m1d1Activities) {
        await service.recordActivityCompletion(
          makeResult({
            activityId: act.id,
            completed: true,
            correct: true,
            attempts: 1,
          }),
          act
        );
      }

      const dayProg = await service.getDayProgress(1, 1);
      expect(dayProg.completedActivities).toBe(24);
      expect(dayProg.totalActivities).toBe(24);
      expect(dayProg.percent).toBe(100);
      expect(dayProg.isCompleted).toBe(true);
      expect(dayProg.firstTryAccuracy).toBe(100);
      expect(dayProg.overallAccuracy).toBe(100);
    });
  });

  describe('3. Module Progress Derived From Days', () => {
    it('derives module progress strictly from completed days (completedDays / 5)', async () => {
      const initialMod = await service.getModuleProgress(1);
      expect(initialMod.completedDays).toBe(0);
      expect(initialMod.totalDays).toBe(5);
      expect(initialMod.percent).toBe(0);
      expect(initialMod.isCompleted).toBe(false);
      expect(initialMod.status).toBe('not-started');

      // Complete Day 1
      const d1Acts = await contentRepo.getActivities({ subject: 'English', module: 1, day: 1 });
      for (const act of d1Acts) {
        await service.recordActivityCompletion(
          makeResult({ activityId: act.id, completed: true, correct: true, attempts: 1 }),
          act
        );
      }

      const afterD1 = await service.getModuleProgress(1);
      expect(afterD1.completedDays).toBe(1);
      expect(afterD1.percent).toBe(20); // 1 / 5 = 20%
      expect(afterD1.isCompleted).toBe(false);
      expect(afterD1.status).toBe('in-progress');

      // Complete Days 2 and 3
      for (let day = 2; day <= 3; day++) {
        const acts = await contentRepo.getActivities({ subject: 'English', module: 1, day });
        for (const act of acts) {
          await service.recordActivityCompletion(
            makeResult({ activityId: act.id, completed: true, correct: true, attempts: 1 }),
            act
          );
        }
      }

      const afterD3 = await service.getModuleProgress(1);
      expect(afterD3.completedDays).toBe(3);
      expect(afterD3.percent).toBe(60); // 3 / 5 = 60%
      expect(afterD3.isCompleted).toBe(false);
      expect(afterD3.status).toBe('in-progress');

      // Complete Days 4 and 5
      for (let day = 4; day <= 5; day++) {
        const acts = await contentRepo.getActivities({ subject: 'English', module: 1, day });
        for (const act of acts) {
          await service.recordActivityCompletion(
            makeResult({ activityId: act.id, completed: true, correct: true, attempts: 1 }),
            act
          );
        }
      }

      const afterD5 = await service.getModuleProgress(1);
      expect(afterD5.completedDays).toBe(5);
      expect(afterD5.percent).toBe(100);
      expect(afterD5.isCompleted).toBe(true);
      expect(afterD5.status).toBe('completed');
    });
  });

  describe('4. Word-Level Mastery Tracking', () => {
    it('evaluates word mastery state transitions: unstarted -> learning -> mastered', async () => {
      // Find a word from Module 1 that has a review activity in a subsequent module (e.g. EW001)
      const allActs = await contentRepo.getActivities({ subject: 'English' });
      const ew001New = allActs.find((a) => a.source?.ewId === 'EW001' && a.role === 'new')!;
      const ew001Reviews = allActs.filter((a) => a.source?.ewId === 'EW001' && a.role === 'review');

      expect(ew001New).toBeDefined();
      expect(ew001Reviews.length).toBeGreaterThanOrEqual(1);

      // 1. Initial: unstarted
      const initial = await service.getWordMastery('EW001');
      expect(initial).not.toBeNull();
      expect(initial?.status).toBe('unstarted');
      expect(initial?.newExposureCompleted).toBe(false);
      expect(initial?.reviewActivitiesCompleted).toBe(0);

      // 2. Complete new exposure only: status becomes 'learning'
      await service.recordActivityCompletion(
        makeResult({ activityId: ew001New.id, completed: true, correct: true, attempts: 1 }),
        ew001New
      );

      const afterNew = await service.getWordMastery('EW001');
      expect(afterNew?.status).toBe('learning');
      expect(afterNew?.newExposureCompleted).toBe(true);
      expect(afterNew?.reviewActivitiesCompleted).toBe(0);

      // 3. Complete review activity with attempts > 1 so accuracy is below 80% (1 correct out of 2 attempts = 50%)
      const firstReview = ew001Reviews[0];
      await service.recordActivityCompletion(
        makeResult({ activityId: firstReview.id, completed: true, correct: true, attempts: 2 }),
        firstReview
      );

      const afterLowReview = await service.getWordMastery('EW001');
      expect(afterLowReview?.reviewActivitiesCompleted).toBe(1);
      expect(afterLowReview?.reviewAccuracy).toBe(50);
      expect(afterLowReview?.status).toBe('learning'); // Not mastered because 50% < 80%

      // 4. Test high review accuracy (100% >= 80%) on a word with 1 attempt
      const ew002New = allActs.find((a) => a.source?.ewId === 'EW002' && a.role === 'new')!;
      const ew002Reviews = allActs.filter((a) => a.source?.ewId === 'EW002' && a.role === 'review');
      expect(ew002Reviews.length).toBeGreaterThanOrEqual(1);

      await service.recordActivityCompletion(
        makeResult({ activityId: ew002New.id, completed: true, correct: true, attempts: 1 }),
        ew002New
      );
      await service.recordActivityCompletion(
        makeResult({ activityId: ew002Reviews[0].id, completed: true, correct: true, attempts: 1 }),
        ew002Reviews[0]
      );

      const ew002Mastery = await service.getWordMastery('EW002');
      expect(ew002Mastery?.newExposureCompleted).toBe(true);
      expect(ew002Mastery?.reviewActivitiesCompleted).toBe(1);
      expect(ew002Mastery?.reviewAccuracy).toBe(100);
      expect(ew002Mastery?.status).toBe('mastered');
    });
  });

  describe('5. Deterministic Recommended Session', () => {
    it('recommends Module 1 · Day 1 when nothing is completed', async () => {
      const rec = await service.getRecommendedSession();
      expect(rec.module).toBe(1);
      expect(rec.day).toBe(1);
      expect(rec.label).toBe('Module 1 · Day 1');
    });

    it('recommends Module 1 · Day 3 when Days 1 and 2 are fully completed', async () => {
      for (let day = 1; day <= 2; day++) {
        const acts = await contentRepo.getActivities({ subject: 'English', module: 1, day });
        for (const act of acts) {
          await service.recordActivityCompletion(
            makeResult({ activityId: act.id, completed: true, correct: true, attempts: 1 }),
            act
          );
        }
      }

      const rec = await service.getRecommendedSession();
      expect(rec.module).toBe(1);
      expect(rec.day).toBe(3);
      expect(rec.label).toBe('Module 1 · Day 3');
    });

    it('advances to Module 2 · Day 1 when all 5 days of Module 1 are completed', async () => {
      for (let day = 1; day <= 5; day++) {
        const acts = await contentRepo.getActivities({ subject: 'English', module: 1, day });
        for (const act of acts) {
          await service.recordActivityCompletion(
            makeResult({ activityId: act.id, completed: true, correct: true, attempts: 1 }),
            act
          );
        }
      }

      const rec = await service.getRecommendedSession();
      expect(rec.module).toBe(2);
      expect(rec.day).toBe(1);
      expect(rec.label).toBe('Module 2 · Day 1');
    });
  });

  describe('6. Curriculum Summary Aggregation', () => {
    it('returns exact baseline totals (958 words, 280 reviews, 1238 activities, 8 modules)', async () => {
      const curr = await service.getCurriculumProgress();
      expect(curr.totalWords).toBe(958);
      expect(curr.wordsLearned).toBe(0);
      expect(curr.wordsMastered).toBe(0);
      expect(curr.totalReviews).toBe(280);
      expect(curr.reviewsCompleted).toBe(0);
      expect(curr.totalActivities).toBe(1238);
      expect(curr.activitiesCompleted).toBe(0);
      expect(curr.totalModules).toBe(8);
      expect(curr.modulesCompleted).toBe(0);
      expect(curr.curriculumPercent).toBe(0);
    });

    it('computes words learned and curriculum percentage without collapsing into mastery', async () => {
      // Complete all 24 new words in Module 1 Day 1
      const m1d1 = await contentRepo.getActivities({ subject: 'English', module: 1, day: 1 });
      for (const act of m1d1) {
        await service.recordActivityCompletion(
          makeResult({ activityId: act.id, completed: true, correct: true, attempts: 1 }),
          act
        );
      }

      const curr = await service.getCurriculumProgress();
      expect(curr.wordsLearned).toBe(24);
      expect(curr.wordsMastered).toBe(0); // None mastered yet because M1 has no reviews
      expect(curr.activitiesCompleted).toBe(24);
      expect(curr.curriculumPercent).toBe(Math.round((24 / 958) * 100)); // ~3%
    });
  });
});
