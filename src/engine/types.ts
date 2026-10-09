import React from 'react';
import { Activity, ActivityCategory, ActivityVariant } from '../types';

// ============================================================================
// RUNTIME STATE
// ============================================================================

export type ActivityStatus = 'idle' | 'active' | 'completed';

export interface ActivityRuntimeState {
  activityId: string;
  status: ActivityStatus;
  attempts: number;
  startedAt?: number;
  completedAt?: number;
}

// ============================================================================
// INPUT & EVALUATION
// ============================================================================

export type ActivityInput = unknown;

export interface ActivityFeedback {
  message?: string;
  type?: 'success' | 'error' | 'hint' | 'info';
}

export interface ActivityEvaluation {
  correct: boolean;
  completed: boolean;
  attempts: number;
  feedback?: ActivityFeedback;
}

// ============================================================================
// STANDARDIZED RESULT
// ============================================================================

export interface ActivityResult {
  activityId: string;
  completed: boolean;
  correct?: boolean;
  attempts: number;
  startedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ENGINE INTERFACES
// ============================================================================

export interface ActivityEvaluator<TInput = unknown> {
  evaluate(activity: Activity, input: TInput, state: ActivityRuntimeState): ActivityEvaluation;
}

export interface ActivityEngine {
  start(activity: Activity): ActivityRuntimeState;
  submit(activity: Activity, state: ActivityRuntimeState, input: ActivityInput, evaluator: ActivityEvaluator): {
    nextState: ActivityRuntimeState;
    evaluation: ActivityEvaluation;
  };
  reset(state: ActivityRuntimeState): ActivityRuntimeState;
}

// ============================================================================
// REGISTRY
// ============================================================================

export interface ActivityComponentProps<TInput = unknown> {
  activity: Activity;
  state: ActivityRuntimeState;
  onSubmit: (input: TInput) => void;
  onNext?: () => void;
}

export interface ActivityDefinition {
  category: ActivityCategory | 'unknown';
  variant: ActivityVariant | 'unknown';
  component: React.ComponentType<ActivityComponentProps<unknown>>;
  evaluator: ActivityEvaluator<unknown>;
}

// ============================================================================
// SESSION
// ============================================================================

export type SessionStatus = 'not-started' | 'active' | 'completed';

export interface ActivitySession {
  id: string;
  activityIds: string[];
  currentIndex: number;
  completedActivityIds: string[];
  results: Record<string, ActivityResult>;
  status: SessionStatus;
  startedAt?: number;
  completedAt?: number;
}

export type SessionSize = { mode: 'all' } | { mode: 'fixed'; count: number };

export interface SessionConfig {
  classId: string;
  subjectId: string;
  category: ActivityCategory | null;
  level?: number;
  size: SessionSize;
  module?: number;
  day?: number;
  activityId?: string;
}
