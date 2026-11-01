// @vitest-environment jsdom
/**
 * T2. Logout never calls localStorage.clear() / sessionStorage.clear().
 * Test:
 * 1. Put an unrelated key and a pending outbox item for student A in storage.
 * 2. Log student A out.
 * 3. Assert both still exist, and only "sa.student.<A>.*" session keys are removed.
 * 4. Pending items are flushed/sent ONLY under A's next session, NEVER under student B's session.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { StudentProvider } from '../StudentContext';
import { useStudent } from '../useStudent';
import { offlineOutbox } from '../../services/OfflineOutboxQueue';
import { neonSync } from '../../services/NeonSyncService';

describe('T2: Logout storage isolation and scoped outbox flushing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('logout preserves unrelated keys and pending student A outbox items; removes only sa.student.<A>.* keys', async () => {
    // 1. Seed storage with unrelated key, outbox item for Student A, and student session keys
    window.localStorage.setItem('unrelated_app_preference', 'keep_me_safe');
    window.sessionStorage.setItem('unrelated_session_temp', 'keep_me_too');

    const studentAAttempt = {
      id: 'att-student-a-1',
      studentId: 'student-A',
      activityId: 'Q001',
      attemptNumber: 1,
      result: 'correct' as const,
      completed: true,
      timestamp: new Date().toISOString(),
    };

    window.localStorage.setItem('sa.outbox.attempts.v1', JSON.stringify([studentAAttempt]));
    window.localStorage.setItem('sa.student.student-A.progress', 'saved_progress_data');
    window.localStorage.setItem('sa.activeStudentId.v1', 'student-A');

    // Spy on clear to ensure it is NEVER called
    const localClearSpy = vi.spyOn(Storage.prototype, 'clear');

    // Mock fetch for /api/student/logout
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(StudentProvider, null, children);

    const { result } = renderHook(() => useStudent(), { wrapper });

    // 2. Perform logout
    await act(async () => {
      await result.current.logout();
    });

    // 3. Assert localStorage.clear() and sessionStorage.clear() were NEVER called
    expect(localClearSpy).not.toHaveBeenCalled();

    // 4. Assert unrelated keys remain intact
    expect(window.localStorage.getItem('unrelated_app_preference')).toBe('keep_me_safe');
    expect(window.sessionStorage.getItem('unrelated_session_temp')).toBe('keep_me_too');

    // 5. Assert outbox item for student A is PRESERVED (NOT deleted by logout!)
    const preservedOutbox = JSON.parse(window.localStorage.getItem('sa.outbox.attempts.v1') || '[]');
    expect(preservedOutbox).toHaveLength(1);
    expect(preservedOutbox[0].id).toBe('att-student-a-1');
    expect(preservedOutbox[0].studentId).toBe('student-A');

    // 6. Assert student A session keys are removed
    expect(window.localStorage.getItem('sa.student.student-A.progress')).toBeNull();
    expect(window.localStorage.getItem('sa.activeStudentId.v1')).toBeNull();
  });

  it('pending items for student A are sent only under As session, never under student Bs session', async () => {
    const studentAAttempt = {
      id: 'att-student-a-1',
      studentId: 'student-A',
      activityId: 'Q001',
      attemptNumber: 1,
      result: 'correct' as const,
      completed: true,
      timestamp: new Date().toISOString(),
    };

    window.localStorage.setItem('sa.outbox.attempts.v1', JSON.stringify([studentAAttempt]));

    const syncAttemptSpy = vi.spyOn(neonSync, 'syncAttempt').mockResolvedValue(true);

    // If Student B logs in / activates, Student B's outbox flush must NOT send Student A's attempt
    await offlineOutbox.flush('student-B');

    // Should NOT have sent student A's item during student B's flush!
    expect(syncAttemptSpy).not.toHaveBeenCalled();

    // Now Student A logs in: flush for Student A MUST send Student A's item
    await offlineOutbox.flush('student-A');
    expect(syncAttemptSpy).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'student-A' }));
  });
});
