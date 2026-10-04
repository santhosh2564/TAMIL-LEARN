import { Activity } from '../types';
import { ActivityResult } from '../engine/types';
import { ActivityProgress } from './types';
import { ProgressRepository } from './ProgressRepository';
import { LocalProgressRepository, ENGLISH_STORAGE_KEY } from './LocalProgressRepository';
import { LocalContentRepository } from '../repositories/implementations/LocalContentRepository';
import {
  WordMasteryProgress,
  EnglishDayProgress,
  EnglishModuleProgress,
  EnglishCurriculumProgress
} from './english/types';

// ============================================================================
// ENGLISH PROGRESS SERVICE
// Independent aggregator for Class 3 English vocabulary and mastery tracking.
// Fully decoupled from Tamil progress persistence.
// ============================================================================

export class EnglishProgressService {
  private repository: ProgressRepository;
  private contentRepo: LocalContentRepository;
  private englishActivities: Activity[] | null = null;
  private newWordActivitiesByEwId = new Map<string, Activity>();
  private reviewActivitiesByEwId = new Map<string, Activity[]>();
  private activitiesByModuleAndDay = new Map<string, Activity[]>();

  constructor(
    repository: ProgressRepository = new LocalProgressRepository(ENGLISH_STORAGE_KEY),
    contentRepo: LocalContentRepository = new LocalContentRepository()
  ) {
    this.repository = repository;
    this.contentRepo = contentRepo;
  }

  /**
   * Loads and indexes all English activities once for fast lookup.
   */
  private async ensureIndexed(): Promise<void> {
    if (this.englishActivities) return;

    this.englishActivities = await this.contentRepo.getActivities({ subject: 'English' });

    for (const act of this.englishActivities) {
      const ewId = act.source?.ewId;
      if (ewId) {
        if (act.role === 'new') {
          this.newWordActivitiesByEwId.set(ewId, act);
        } else if (act.role === 'review') {
          const list = this.reviewActivitiesByEwId.get(ewId) || [];
          list.push(act);
          this.reviewActivitiesByEwId.set(ewId, list);
        }
      }

      if (act.module && act.day) {
        const key = `${act.module}_${act.day}`;
        const list = this.activitiesByModuleAndDay.get(key) || [];
        list.push(act);
        this.activitiesByModuleAndDay.set(key, list);
      }
    }
  }

  /**
   * Records completion of an English activity.
   */
  async recordActivityCompletion(
    result: ActivityResult,
    activity: Activity
  ): Promise<void> {
    if (!result.completed) return;

    // Succeeded on first attempt if attempts === 1 and correct
    const isFirstAttemptCorrect = result.attempts === 1 && (result.correct ?? true);
    const isFinalCorrect = result.correct ?? true;

    const progress: ActivityProgress = {
      activityId: result.activityId,
      category: activity.category,
      completed: result.completed,
      correct: isFinalCorrect,
      attempts: result.attempts,
      firstAttemptCorrect: isFirstAttemptCorrect,
      finalCorrect: isFinalCorrect,
      lastCompletedAt: result.completedAt
        ? new Date(result.completedAt).toISOString()
        : new Date().toISOString(),
      lastAttemptedAt: new Date().toISOString(),
    };

    await this.repository.saveActivityProgress(progress);
  }

  /**
   * Retrieves raw progress for a single activity.
   */
  async getActivityProgress(activityId: string): Promise<ActivityProgress | null> {
    return this.repository.getActivityProgress(activityId);
  }

  /**
   * Returns all stored English activity progress.
   */
  async getAllActivityProgress(): Promise<Record<string, ActivityProgress>> {
    return this.repository.getAllProgress();
  }

  /**
   * Calculates progress for a specific day in a module.
   */
  async getDayProgress(moduleNumber: number, dayNumber: number): Promise<EnglishDayProgress> {
    await this.ensureIndexed();

    const activities = this.activitiesByModuleAndDay.get(`${moduleNumber}_${dayNumber}`) || [];
    const totalActivities = activities.length;

    if (totalActivities === 0) {
      return {
        module: moduleNumber,
        day: dayNumber,
        totalActivities: 0,
        completedActivities: 0,
        percent: 0,
        isCompleted: false,
        firstTryAccuracy: 0,
        overallAccuracy: 0
      };
    }

    const allProgress = await this.repository.getAllProgress();
    let completedCount = 0;
    let firstTryCorrectCount = 0;
    let totalAttempts = 0;
    let totalCorrectAttempts = 0;

    for (const act of activities) {
      const p = allProgress[act.id];
      if (p && p.completed) {
        completedCount++;
        if (p.firstAttemptCorrect) {
          firstTryCorrectCount++;
        }
        totalAttempts += p.attempts;
        if (p.correct) {
          totalCorrectAttempts++;
        }
      }
    }

    const isCompleted = completedCount === totalActivities;
    const percent = Math.round((completedCount / totalActivities) * 100);
    const firstTryAccuracy = completedCount > 0
      ? Math.round((firstTryCorrectCount / completedCount) * 100)
      : 0;
    const overallAccuracy = totalAttempts > 0
      ? Math.round((totalCorrectAttempts / totalAttempts) * 100)
      : 0;

    return {
      module: moduleNumber,
      day: dayNumber,
      totalActivities,
      completedActivities: completedCount,
      percent,
      isCompleted,
      firstTryAccuracy,
      overallAccuracy
    };
  }

  /**
   * Calculates progress for a module, derived from its 5 days.
   */
  async getModuleProgress(moduleNumber: number): Promise<EnglishModuleProgress> {
    await this.ensureIndexed();

    const manifest = await this.contentRepo.getEnglishModuleManifest(moduleNumber);
    const title = manifest?.title || `Module ${moduleNumber}`;

    let completedDays = 0;
    let totalActivities = 0;
    let completedActivities = 0;
    let totalFirstTryCorrect = 0;
    let totalAttempts = 0;
    let totalCorrectAttempts = 0;

    const allProgress = await this.repository.getAllProgress();

    for (let day = 1; day <= 5; day++) {
      const dayActs = this.activitiesByModuleAndDay.get(`${moduleNumber}_${day}`) || [];
      const dayTotal = dayActs.length;
      totalActivities += dayTotal;

      let dayCompleted = 0;
      for (const act of dayActs) {
        const p = allProgress[act.id];
        if (p && p.completed) {
          dayCompleted++;
          completedActivities++;
          if (p.firstAttemptCorrect) totalFirstTryCorrect++;
          totalAttempts += p.attempts;
          if (p.correct) totalCorrectAttempts++;
        }
      }

      if (dayTotal > 0 && dayCompleted === dayTotal) {
        completedDays++;
      }
    }

    const percent = Math.round((completedDays / 5) * 100);
    const isCompleted = completedDays === 5;
    const status = isCompleted
      ? 'completed'
      : (completedActivities > 0 ? 'in-progress' : 'not-started');

    const firstTryAccuracy = completedActivities > 0
      ? Math.round((totalFirstTryCorrect / completedActivities) * 100)
      : 0;
    const overallAccuracy = totalAttempts > 0
      ? Math.round((totalCorrectAttempts / totalAttempts) * 100)
      : 0;

    return {
      module: moduleNumber,
      title,
      totalDays: 5,
      completedDays,
      totalActivities,
      completedActivities,
      percent,
      isCompleted,
      firstTryAccuracy,
      overallAccuracy,
      status
    };
  }

  /**
   * Returns progress for all 8 modules.
   */
  async getAllModulesProgress(): Promise<EnglishModuleProgress[]> {
    const list: EnglishModuleProgress[] = [];
    for (let m = 1; m <= 8; m++) {
      list.push(await this.getModuleProgress(m));
    }
    return list;
  }

  /**
   * Evaluates word-level mastery for a single vocabulary word (EW ID).
   */
  async getWordMastery(ewId: string): Promise<WordMasteryProgress | null> {
    await this.ensureIndexed();

    const newAct = this.newWordActivitiesByEwId.get(ewId);
    if (!newAct) return null;

    const reviewActs = this.reviewActivitiesByEwId.get(ewId) || [];
    const allProgress = await this.repository.getAllProgress();

    const newProg = allProgress[newAct.id];
    const newExposureCompleted = Boolean(newProg && newProg.completed);

    let reviewCompletedCount = 0;
    let reviewTotalAttempts = 0;
    let reviewCorrectAttempts = 0;
    let firstAttemptCorrectCount = 0;
    let totalAttempts = newProg?.attempts || 0;

    if (newProg?.firstAttemptCorrect) {
      firstAttemptCorrectCount++;
    }

    for (const rAct of reviewActs) {
      const rp = allProgress[rAct.id];
      if (rp && rp.completed) {
        reviewCompletedCount++;
        reviewTotalAttempts += rp.attempts;
        totalAttempts += rp.attempts;
        if (rp.correct) reviewCorrectAttempts++;
        if (rp.firstAttemptCorrect) firstAttemptCorrectCount++;
      }
    }

    const reviewAccuracy = reviewTotalAttempts > 0
      ? Math.round((reviewCorrectAttempts / reviewTotalAttempts) * 100)
      : 0;

    // Minimum mastery rule:
    // New-word activity completed + at least one associated spaced-review activity completed with review accuracy >= 80%.
    let status: 'unstarted' | 'learning' | 'mastered' = 'unstarted';
    if (!newExposureCompleted) {
      status = 'unstarted';
    } else if (reviewCompletedCount >= 1 && reviewAccuracy >= 80) {
      status = 'mastered';
    } else {
      status = 'learning';
    }

    return {
      ewId,
      targetWord: newAct.targetWord || '',
      originModule: newAct.module || 1,
      status,
      newExposureCompleted,
      reviewActivitiesTotal: reviewActs.length,
      reviewActivitiesCompleted: reviewCompletedCount,
      firstAttemptCorrectCount,
      totalAttempts,
      reviewAccuracy
    };
  }

  /**
   * Evaluates word-level mastery for all 958 unique vocabulary words.
   */
  async getAllWordMastery(): Promise<Record<string, WordMasteryProgress>> {
    await this.ensureIndexed();
    const result: Record<string, WordMasteryProgress> = {};
    for (const ewId of this.newWordActivitiesByEwId.keys()) {
      const m = await this.getWordMastery(ewId);
      if (m) result[ewId] = m;
    }
    return result;
  }

  /**
   * Determines the first uncompleted day in strict curriculum order.
   */
  async getRecommendedSession(): Promise<{ module: number; day: number; label: string }> {
    for (let m = 1; m <= 8; m++) {
      for (let d = 1; d <= 5; d++) {
        const dayProg = await this.getDayProgress(m, d);
        if (!dayProg.isCompleted) {
          return {
            module: m,
            day: d,
            label: `Module ${m} · Day ${d}`
          };
        }
      }
    }
    // All modules completed: recommend Module 8 Day 5 practice
    return {
      module: 8,
      day: 5,
      label: 'Module 8 · Day 5'
    };
  }

  /**
   * Calculates overall curriculum-level summary.
   */
  async getCurriculumProgress(): Promise<EnglishCurriculumProgress> {
    await this.ensureIndexed();

    const allProgress = await this.repository.getAllProgress();
    let wordsLearned = 0;
    let reviewsCompleted = 0;
    let activitiesCompleted = 0;

    for (const act of this.englishActivities || []) {
      const p = allProgress[act.id];
      if (p && p.completed) {
        activitiesCompleted++;
        if (act.role === 'new') {
          wordsLearned++;
        } else if (act.role === 'review') {
          reviewsCompleted++;
        }
      }
    }

    // Evaluate mastered words
    const masteryMap = await this.getAllWordMastery();
    const wordsMastered = Object.values(masteryMap).filter(w => w.status === 'mastered').length;

    // Evaluate completed modules
    let modulesCompleted = 0;
    for (let m = 1; m <= 8; m++) {
      const modProg = await this.getModuleProgress(m);
      if (modProg.isCompleted) {
        modulesCompleted++;
      }
    }

    const curriculumPercent = Math.round((wordsLearned / 958) * 100);
    const recommendedSession = await this.getRecommendedSession();

    return {
      totalWords: 958,
      wordsLearned,
      wordsMastered,
      totalReviews: 280,
      reviewsCompleted,
      totalActivities: 1238,
      activitiesCompleted,
      totalModules: 8,
      modulesCompleted,
      curriculumPercent,
      recommendedSession
    };
  }

  /**
   * Clears English progress snapshot only.
   */
  async clearProgress(): Promise<void> {
    await this.repository.clearProgress();
  }
}
