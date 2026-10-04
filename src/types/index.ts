// Domain types foundation

export interface Class {
  id: string;
  name: string;
  description?: string;
}

export interface Subject {
  id: string;
  name: string;
  classId: string;
}

export interface Lesson {
  id: string;
  title: string;
  subjectId: string;
  order: number;
}

export type ActivityCategory = 
  | 'picture-recognition'
  | 'word-completion'
  | 'arrange-word'
  | 'spelling-choice'
  | 'context-choice'
  | 'meaning-match';

export type ActivityVariant = 
  | 'select'
  | 'missing-unit'
  | 'arrange'
  | 'fill-blank'
  | 'translate-select'
  | 'word-entry';

export interface ContentAsset {
  type: 'image' | 'audio';
  source: string;
  alt?: string;
}

export interface ActivityOption {
  id: string;
  label: string;
}

export interface Activity {
  id: string;
  classLevel: number;
  subject: string;
  language: string;
  term?: string;
  module?: number;
  day?: number;
  role?: 'new' | 'review';
  reviewSourceModule?: number;
  level: number;
  sourceDifficulty?: string;
  targetWord?: string;
  category: ActivityCategory;
  variant: ActivityVariant;
  prompt: string;
  instruction?: string;
  options?: ActivityOption[];
  units?: string[];
  template?: string;
  correctAnswer: string | string[];
  image?: ContentAsset;
  audio?: ContentAsset;
  learningObjective?: string;
  interactionDetail?: string;
  source: {
    workbook: string;
    questionId?: string;
    ewId?: string;
    activityCode?: string;
    originalActivity?: string;
    hasSourceAnomaly?: boolean;
    anomalyNote?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ActivitySession {
  id: string;
  activityId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  score?: number;
  status: 'started' | 'completed' | 'abandoned';
}

export interface LearningProgress {
  userId: string;
  subjectId: string;
  completedActivities: string[];
  lastAccessed: string;
}

export interface ContentValidationIssue {
  activityId?: string;
  type: 'error' | 'warning';
  message: string;
}

export interface ContentValidationResult {
  valid: boolean;
  totalActivities: number;
  errors: ContentValidationIssue[];
  warnings: ContentValidationIssue[];
}

export interface ContentManifest {
  classLevel: number;
  subject: string;
  term?: string;
  language: string;
  activityCount: number;
  version: string;
  sourceVersion: string;
  generatedDate: string;
  supportedCategories: ActivityCategory[];
}

export interface EnglishDayAllocation {
  day: number;
  newCount: number;
  reviewCount: number;
  totalCount: number;
}

export interface EnglishDifficultyBreakdown {
  easy: number;
  medium: number;
  hard: number;
  mixed: number;
  unclassified: number;
}

export interface EnglishModuleManifest {
  classLevel: 3;
  subject: 'English';
  module: number;
  title: string;
  newWordCount: number;
  reviewWordCount: number;
  totalActivities: number;
  days: EnglishDayAllocation[];
  difficultyBreakdown: EnglishDifficultyBreakdown;
  supportedCategories: ActivityCategory[];
  version: string;
}

export interface EnglishCurriculumManifest {
  classLevel: 3;
  subject: 'English';
  language: 'en-IN';
  totalUniqueWords: number;
  totalReviewInstances: number;
  totalActivities: number;
  moduleCount: number;
  modules: {
    module: number;
    title: string;
    newWordCount: number;
    reviewWordCount: number;
    totalActivities: number;
  }[];
  difficultyBreakdown: EnglishDifficultyBreakdown;
  version: string;
  sourceVersion: string;
  generatedDate: string;
}

export interface ActivityQuery {
  classLevel?: number;
  subject?: string;
  term?: string;
  module?: number;
  day?: number;
  role?: 'new' | 'review';
  category?: ActivityCategory;
  variant?: ActivityVariant;
  level?: number;
}

export class ActivityNotFoundError extends Error {
  constructor(id: string) {
    super(`Activity with ID ${id} not found`);
    this.name = 'ActivityNotFoundError';
  }
}

// Future authentication / entity models
export interface User {
  id: string;
  role: 'student' | 'teacher' | 'admin' | 'parent';
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  type: 'school' | 'ngo' | 'other';
}

export interface School extends Organization {
  type: 'school';
  address?: string;
}

export interface Teacher extends User {
  role: 'teacher';
  schoolId: string;
}

export interface Assignment {
  id: string;
  teacherId: string;
  classId: string;
  activityIds: string[];
  dueDate: string;
}
