// ============================================================================
// ENGLISH PROGRESS & WORD MASTERY TYPES
// Strictly decoupled from raw activity persistence.
// ============================================================================

export type WordMasteryStatus = 'unstarted' | 'learning' | 'mastered';

export interface WordMasteryProgress {
  ewId: string;
  targetWord: string;
  originModule: number;
  status: WordMasteryStatus;
  newExposureCompleted: boolean;
  reviewActivitiesTotal: number;
  reviewActivitiesCompleted: number;
  firstAttemptCorrectCount: number;
  totalAttempts: number;
  reviewAccuracy: number; // 0–100 percentage
}

export interface EnglishDayProgress {
  module: number;
  day: number;
  totalActivities: number;
  completedActivities: number;
  percent: number; // 0–100 based on completedActivities / totalActivities
  isCompleted: boolean; // completedActivities === totalActivities
  firstTryAccuracy: number; // 0–100 percentage
  overallAccuracy: number; // 0–100 percentage
}

export interface EnglishModuleProgress {
  module: number;
  title: string;
  totalDays: number; // 5
  completedDays: number; // 0–5
  totalActivities: number; // e.g. 120 (M1), 160 (M2–M7), 158 (M8)
  completedActivities: number;
  percent: number; // 0–100 based on completedDays / 5 * 100
  isCompleted: boolean; // completedDays === 5
  firstTryAccuracy: number; // 0–100 percentage
  overallAccuracy: number; // 0–100 percentage
  status: 'not-started' | 'in-progress' | 'completed';
}

export interface EnglishCurriculumProgress {
  totalWords: number; // 958
  wordsLearned: number; // Unique words with completed new-word exposure
  wordsMastered: number; // Unique words meeting the mastery criteria
  totalReviews: number; // 280
  reviewsCompleted: number;
  totalActivities: number; // 1,238
  activitiesCompleted: number;
  totalModules: number; // 8
  modulesCompleted: number;
  curriculumPercent: number; // wordsLearned / 958 * 100
  recommendedSession: {
    module: number;
    day: number;
    label: string; // e.g. "Module 1 · Day 1"
  };
}
