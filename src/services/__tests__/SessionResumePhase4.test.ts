import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionSyncService, ActiveSessionDto } from '../SessionSyncService';
import { AssessmentTrackingService } from '../AssessmentTrackingService';
import { AssessmentOutboxQueue } from '../AssessmentOutboxQueue';

describe('Phase 4: Assessment Session Persistence & Resume Across Refresh/Devices', () => {
  let sessionSync: SessionSyncService;
  let tracker: AssessmentTrackingService;
  let outbox: AssessmentOutboxQueue;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionSync = new SessionSyncService();
    outbox = new AssessmentOutboxQueue();
    tracker = new AssessmentTrackingService(outbox);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. getActiveSession retrieves active assessment session from Neon API and caches locally', async () => {
    const studentId = 'stud_phase4_1';
    const mockAssessmentSession = {
      id: 'asess_neon_100',
      school_id: 'school_1',
      student_id: studentId,
      subject_id: 'tamil',
      module_id: 2,
      session_status: 'in_progress',
      current_activity_id: 'FTS0015',
      current_question_id: 'FTS0015',
      current_question_index: 3,
      activity_ids: ['FTS0012', 'FTS0013', 'FTS0014', 'FTS0015', 'FTS0016'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/assessment-sessions/active')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ session: mockAssessmentSession }),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    const active = await sessionSync.getActiveSession(studentId, 'tamil');
    expect(active).not.toBeNull();
    expect(active!.id).toBe('asess_neon_100');
    expect(active!.currentIndex).toBe(3);
    expect(active!.activityIds.length).toBe(5);
    expect(active!.status).toBe('active');

    // Verify it is cached in localStorage for offline recovery
    const cached = sessionSync.getLocalSession(studentId);
    expect(cached).not.toBeNull();
    expect(cached!.id).toBe('asess_neon_100');
    expect(cached!.currentIndex).toBe(3);
  });

  it('2. getActiveSession falls back to local storage when network is disconnected (offline)', async () => {
    const studentId = 'stud_offline_resume';
    const cachedDto: ActiveSessionDto = {
      id: 'asess_offline_200',
      schoolId: 'school_offline',
      studentId,
      subject: 'english',
      categoryOrModule: 'module-1',
      activityIds: ['ENG-M1-EW001', 'ENG-M1-EW002', 'ENG-M1-EW003'],
      currentIndex: 1,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessionSync.setLocalSession(studentId, cachedDto);

    // Network request fails completely
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error (offline)'));

    const active = await sessionSync.getActiveSession(studentId, 'english');
    expect(active).not.toBeNull();
    expect(active!.id).toBe('asess_offline_200');
    expect(active!.currentIndex).toBe(1);
  });

  it('3. updateSessionProgress advances index, updates local cache and dispatches PATCH to assessment-sessions', async () => {
    const studentId = 'stud_advance';
    const sessionId = 'asess_advance_300';

    const initial: ActiveSessionDto = {
      id: sessionId,
      schoolId: 'school_1',
      studentId,
      subject: 'tamil',
      categoryOrModule: 'mixed',
      activityIds: ['ACT1', 'ACT2', 'ACT3'],
      currentIndex: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessionSync.setLocalSession(studentId, initial);

    const fetchCalls: { url: string; body: unknown }[] = [];
    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      fetchCalls.push({
        url,
        body: opts?.body ? JSON.parse(opts.body as string) : undefined,
      });
      return Promise.resolve({ ok: true, status: 200 } as Response);
    });

    await sessionSync.updateSessionProgress(
      sessionId,
      studentId,
      1,
      'active',
      'ACT2',
      'Q2'
    );

    // Local cache updated synchronously
    const cached = sessionSync.getLocalSession(studentId);
    expect(cached!.currentIndex).toBe(1);

    // Both legacy and assessment_sessions endpoints dispatched
    const patchAssessment = fetchCalls.find((c) =>
      c.url.includes(`/api/assessment-sessions/${sessionId}`)
    );
    expect(patchAssessment).toBeDefined();
    expect(patchAssessment!.body).toEqual({
      currentIndex: 1,
      currentActivityId: 'ACT2',
      currentQuestionId: 'Q2',
      sessionStatus: 'in_progress',
    });
  });

  it('4. updateSessionProgress with status completed calls /complete and clears local active cache', async () => {
    const studentId = 'stud_complete';
    const sessionId = 'asess_complete_400';

    const initial: ActiveSessionDto = {
      id: sessionId,
      schoolId: 'school_1',
      studentId,
      subject: 'tamil',
      categoryOrModule: 'mixed',
      activityIds: ['ACT1', 'ACT2'],
      currentIndex: 1,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessionSync.setLocalSession(studentId, initial);

    const fetchCalls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, status: 200 } as Response);
    });

    await sessionSync.updateSessionProgress(
      sessionId,
      studentId,
      2,
      'completed'
    );

    // Active session removed from local storage
    expect(sessionSync.getLocalSession(studentId)).toBeNull();

    // /complete endpoint called
    expect(fetchCalls.some((u) => u.includes(`/api/assessment-sessions/${sessionId}/complete`))).toBe(true);
  });

  it('5. syncAttemptsFromServer populates attempt counts from previous sessions so attempt numbering resumes accurately', async () => {
    const sessionId = 'asess_restore_attempts_500';
    const questionId = 'EW021';

    // Mock API returning 2 previous attempts for EW021
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes(`/api/assessment-sessions/${sessionId}/attempts`)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            attempts: [
              { question_id: questionId, attempt_number: 1, is_correct: false },
              { question_id: questionId, attempt_number: 2, is_correct: false },
            ],
          }),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    await tracker.syncAttemptsFromServer(sessionId);

    // Tracker should know that attempt 2 was already made
    expect(tracker.getAttemptNumber(sessionId, questionId)).toBe(2);

    // Next attempt submission must increment to 3
    expect(tracker.incrementAttemptNumber(sessionId, questionId)).toBe(3);
  });
});
