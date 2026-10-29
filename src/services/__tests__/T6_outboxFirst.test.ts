// @vitest-environment jsdom
/**
 * T6. Outbox-first:
 * - The attempt is in IndexedDB/storage BEFORE fetch is called (assert ordering with a fetch mock).
 * - Removed only on 2xx 'recorded' / 'duplicate'.
 * - 404 goes to a dead-letter store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { neonSync } from '../NeonSyncService';
import { offlineOutbox } from '../OfflineOutboxQueue';
import { AttemptRecord } from '../../attempts/types';

describe('T6: Outbox-first attempt persistence & dead-letter queue', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('verifies attempt is stored in outbox BEFORE fetch is called; removed only on 2xx; 404 moves to dead-letter store', async () => {
    const attempt: AttemptRecord = {
      id: 'att-outbox-first-1',
      studentId: 'student-test-1',
      activityId: 'Q042',
      attemptNumber: 1,
      result: 'correct',
      completed: true,
      timestamp: new Date().toISOString(),
    };

    let attemptInStorageAtFetchTime = false;

    // Mock global fetch to spy on order of execution
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      // Assert attempt is ALREADY in outbox storage when network fetch is invoked
      const queued = await offlineOutbox.getItems();
      if (queued.some((item) => item.id === attempt.id)) {
        attemptInStorageAtFetchTime = true;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'recorded' }),
      } as Response;
    });

    // 1. Send attempt
    await neonSync.syncAttempt(attempt);

    // 2. Assert outbox-first guarantee: item was in storage before fetch was called
    expect(attemptInStorageAtFetchTime, 'Attempt MUST be in outbox BEFORE fetch is dispatched').toBe(true);

    // 3. Assert item is removed from active outbox after successful 200
    const outboxAfter200 = await offlineOutbox.getItems();
    expect(outboxAfter200.find((i) => i.id === attempt.id)).toBeUndefined();

    // 4. Test 404 response (student deleted / not found) -> moves to dead-letter store, NOT infinite retry
    const attempt404: AttemptRecord = {
      id: 'att-deleted-student-2',
      studentId: 'student-deleted-999',
      activityId: 'Q043',
      attemptNumber: 1,
      result: 'correct',
      completed: true,
      timestamp: new Date().toISOString(),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: 'not_found', error: 'Student not found' }),
    } as Response);

    await neonSync.syncAttempt(attempt404);

    // Assert it is removed from active retry outbox
    const activeOutboxAfter404 = await offlineOutbox.getItems();
    expect(activeOutboxAfter404.find((i) => i.id === attempt404.id)).toBeUndefined();

    // Assert it is recorded in dead-letter store
    const deadLetterItems = await offlineOutbox.getDeadLetterItems();
    expect(deadLetterItems.find((i) => i.id === attempt404.id), '404 attempt must be in dead-letter store').toBeDefined();
  });
});
