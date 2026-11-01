/**
 * Unified Assessment Tracking Service.
 *
 * Coordinates question-level attempt recording across Tamil and English activities:
 * 1. Resolves canonical question ID (Tamil: questionId -> activity.id; English: ewId -> activity.id).
 * 2. Distinguishes modules so repeat questions (review activities) track distinct module progress.
 * 3. Enforces monotonic attempt numbering per question within each assessment session.
 * 4. Generates an immutable idempotency key for every submission event.
 * 5. Uses outbox-first persistence: writes to offline storage before network dispatch.
 * 6. Dispatches to POST /api/question-attempts and synchronizes legacy progress services.
 */

import { Activity } from '../types';
import { AssessmentOutboxQueue, QueuedQuestionAttempt, assessmentOutbox } from './AssessmentOutboxQueue';
import { ProgressService, EnglishProgressService } from '../progress';
import { sessionSync } from './SessionSyncService';

export interface RecordSubmissionParams {
  studentId: string;
  sessionId: string;
  activity: Activity;
  fallbackModule?: number;
  input: unknown;
  isCorrect: boolean;
  isCompleted: boolean;
  sessionIndex?: number;
}

export interface RecordSubmissionResult {
  submissionId: string;
  idempotencyKey: string;
  attemptNumber: number;
  questionId: string;
  activityId: string;
  moduleId: number | null;
  subjectId: 'tamil' | 'english';
  synced: boolean;
}

const ATTEMPT_COUNTS_STORAGE_PREFIX = 'sa.assessment.attemptCounts.';

/**
 * Resolves the canonical question identifier.
 * - Tamil activities: source.questionId, falling back to activity.id.
 * - English activities: source.ewId, falling back to source.questionId or activity.id.
 */
export function resolveQuestionId(activity: Activity): string {
  const isEnglish = (activity.subject || '').toLowerCase() === 'english';
  if (isEnglish) {
    return activity.source?.ewId || activity.source?.questionId || activity.id;
  }
  return activity.source?.questionId || activity.id;
}

/**
 * Resolves the numeric module identifier.
 */
export function resolveModuleId(activity: Activity, fallbackModule?: number): number | null {
  if (activity.module !== undefined && activity.module !== null) {
    const parsed = Number(activity.module);
    if (!isNaN(parsed)) return parsed;
  }
  if (fallbackModule !== undefined && fallbackModule !== null) {
    const parsed = Number(fallbackModule);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export class AssessmentTrackingService {
  private static instance: AssessmentTrackingService | null = null;
  private outbox: AssessmentOutboxQueue;
  private attemptCounts = new Map<string, number>();

  static getInstance(): AssessmentTrackingService {
    if (!this.instance) {
      this.instance = new AssessmentTrackingService();
    }
    return this.instance;
  }

  constructor(outbox: AssessmentOutboxQueue = assessmentOutbox) {
    this.outbox = outbox;
  }

  // ── Attempt Number Management ───────────────────────────────────────────────
  private getCountsKey(sessionId: string): string {
    return `${ATTEMPT_COUNTS_STORAGE_PREFIX}${sessionId}`;
  }

  private loadAttemptCounts(sessionId: string): Record<string, number> {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem(this.getCountsKey(sessionId));
        if (raw) return JSON.parse(raw);
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.getCountsKey(sessionId));
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // Storage access disabled / quota
    }
    return {};
  }

  private saveAttemptCounts(sessionId: string, counts: Record<string, number>): void {
    try {
      const serialized = JSON.stringify(counts);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(this.getCountsKey(sessionId), serialized);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getCountsKey(sessionId), serialized);
      }
    } catch {
      // Storage access disabled / quota
    }
  }

  getAttemptNumber(sessionId: string, questionId: string): number {
    const inMemKey = `${sessionId}:${questionId}`;
    if (this.attemptCounts.has(inMemKey)) {
      return this.attemptCounts.get(inMemKey)!;
    }

    const stored = this.loadAttemptCounts(sessionId);
    let count = stored[questionId] || 0;
    const outboxMax = this.outbox.getMaxAttemptNumber(sessionId, questionId);
    if (outboxMax > count) {
      count = outboxMax;
    }
    this.attemptCounts.set(inMemKey, count);
    return count;
  }

  incrementAttemptNumber(sessionId: string, questionId: string): number {
    const current = this.getAttemptNumber(sessionId, questionId);
    const next = current + 1;

    const inMemKey = `${sessionId}:${questionId}`;
    this.attemptCounts.set(inMemKey, next);

    const stored = this.loadAttemptCounts(sessionId);
    stored[questionId] = next;
    this.saveAttemptCounts(sessionId, stored);

    return next;
  }

  /**
   * Synchronizes question attempt numbers with the server for a resumed assessment session.
   * Ensures attempt numbering continues seamlessly across devices or page refreshes.
   */
  async syncAttemptsFromServer(sessionId: string): Promise<void> {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch(`/api/assessment-sessions/${encodeURIComponent(sessionId)}/attempts`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.attempts)) {
        const counts = this.loadAttemptCounts(sessionId);
        for (const att of data.attempts) {
          const qId = att.question_id || att.questionId;
          const num = Number(att.attempt_number || att.attemptNumber) || 1;
          if (!counts[qId] || num > counts[qId]) {
            counts[qId] = num;
          }
          const inMemKey = `${sessionId}:${qId}`;
          if (!this.attemptCounts.has(inMemKey) || num > this.attemptCounts.get(inMemKey)!) {
            this.attemptCounts.set(inMemKey, num);
          }
        }
        this.saveAttemptCounts(sessionId, counts);
      }
    } catch {
      // Offline: keep existing local attempt counts
    }
  }

  // ── Record Submission ───────────────────────────────────────────────────────
  async recordSubmission(
    params: RecordSubmissionParams,
    services?: {
      progressService?: ProgressService;
      englishProgressService?: EnglishProgressService;
    }
  ): Promise<RecordSubmissionResult> {
    const {
      studentId,
      sessionId,
      activity,
      fallbackModule,
      input,
      isCorrect,
      isCompleted,
      sessionIndex,
    } = params;

    const subjectId: 'tamil' | 'english' =
      (activity.subject || '').toLowerCase() === 'english' ? 'english' : 'tamil';
    const questionId = resolveQuestionId(activity);
    const moduleId = resolveModuleId(activity, fallbackModule);
    const attemptNumber = this.incrementAttemptNumber(sessionId, questionId);

    const submissionId = `qatt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idempotencyKey = `idem_${sessionId}_${questionId}_${attemptNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const attemptedAt = new Date().toISOString();

    const answerPayload =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : { answer: input };

    const queuedAttempt: QueuedQuestionAttempt = {
      id: submissionId,
      sessionId,
      studentId,
      subjectId,
      moduleId,
      activityId: activity.id,
      questionId,
      answerPayload,
      isCorrect,
      isCompleted,
      attemptedAt,
      idempotencyKey,
      attemptNumber,
    };

    // 1. Outbox-first: persist locally before network call
    await this.outbox.enqueue(queuedAttempt);

    // 2. Synchronize legacy progress services (Tamil & English)
    if (services?.progressService) {
      services.progressService
        .recordAttempt({
          studentId,
          activityId: activity.id,
          category: activity.category,
          isCorrect,
          isCompleted,
        })
        .catch(() => {});
    }

    // 3. Network transmission to backend
    let synced = false;
    try {
      const res = await fetch('/api/question-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(queuedAttempt),
      });

      if (res.ok) {
        // Successfully recorded or duplicate acknowledged -> remove from outbox
        await this.outbox.remove(submissionId);
        synced = true;
      }
    } catch {
      // Network interruption -> remains in outbox for subsequent flush
      synced = false;
    }

    // 4. Update assessment session position if index provided
    if (sessionIndex !== undefined) {
      sessionSync.updateSessionProgress(
        sessionId,
        studentId,
        sessionIndex,
        isCompleted ? 'active' : 'active'
      );
      fetch(`/api/assessment-sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentActivityId: activity.id,
          currentQuestionId: questionId,
          currentIndex: sessionIndex,
        }),
      }).catch(() => {});
    }

    return {
      submissionId,
      idempotencyKey,
      attemptNumber,
      questionId,
      activityId: activity.id,
      moduleId,
      subjectId,
      synced,
    };
  }

  /**
   * Resets internal attempt cache for a given session.
   */
  clearSessionCache(sessionId: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(this.getCountsKey(sessionId));
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.getCountsKey(sessionId));
      }
    } catch {
      // Storage access disabled
    }
  }
}

export const assessmentTracker = AssessmentTrackingService.getInstance();
