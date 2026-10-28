import { ActivityCategory } from '../types';

export interface StudentProgressSummary {
  studentId: string;
  studentName: string;
  createdAt: string;
  lastActiveAt: string;
  activitiesCompleted: number;
  totalQuestionsAttempted: number;
  questionsCompleted: number;
  firstAttemptCorrectCount: number;
  questionsRetriedCount: number;
  totalRetriesCount: number;
  completionPercentage: number;
}

export interface AdminDashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  totalActivitiesCompleted: number;
  totalQuestionsCompleted: number;
  firstAttemptSuccesses: number;
  questionsRetried: number;
  totalRetries: number;
}

export interface StudentCategoryMastery {
  category: ActivityCategory;
  categoryTitle: string;
  totalAvailable: number;
  completed: number;
  firstAttemptCorrect: number;
  retried: number;
  totalRetries: number;
  completionPercentage: number;
}

export interface QuestionAttemptDetail {
  questionId: string;
  activityTitle: string;
  category: ActivityCategory | string;
  categoryTitle: string;
  subject: string;
  attempts: number;
  retries: number;
  firstAttemptCorrect: boolean;
  status: 'completed' | 'in-progress' | 'not-started';
  lastAttemptAt?: string;
  completedAt?: string;
}

export interface StudentDetailedProgress {
  studentId: string;
  studentName: string;
  createdAt: string;
  lastActiveAt: string;
  summary: StudentProgressSummary;
  categoryMastery: StudentCategoryMastery[];
  questions: QuestionAttemptDetail[];
}
