// @vitest-environment node
/**
 * Tests for counting accumulation, attempt idempotency, and school scoping.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  recordAttemptInDb,
  getStudentsFromDb,
  setDb,
} from '../db';
import type { NeonQueryFunction } from '@neondatabase/serverless';

describe('Counting Bug Fix & Atomic Progress Accumulation', () => {
  let executedSql: Array<{ query: string; params?: unknown[] }> = [];

  beforeEach(() => {
    executedSql = [];
    const mockQuery = (query: string, params?: unknown[]) => {
      executedSql.push({ query, params });
      if (query.includes('FROM students WHERE id =')) {
        return Promise.resolve([{ id: 'stud_1', school_id: 'sch_1', archived_at: null }]);
      }
      if (query.includes('WITH inserted_attempt AS')) {
        return Promise.resolve([{ id: 'client_att_unique_123' }]);
      }
      return Promise.resolve([]);
    };

    const mockSql = Object.assign(
      (query: string, params?: unknown[]) => mockQuery(query, params),
      {
        query: (query: string, params?: unknown[]) => mockQuery(query, params),
      }
    ) as unknown as NeonQueryFunction<false, false>;

    setDb(mockSql);
  });

  afterEach(() => {
    setDb(null);
  });

  it('recordAttemptInDb accumulates attempts and retries atomically via single CTE', async () => {
    const outcome = await recordAttemptInDb({
      id: 'client_att_unique_123',
      studentId: 'stud_1',
      activityId: 'act_1',
      attemptNumber: 1,
      result: 'correct',
      completed: true,
      timestamp: new Date().toISOString(),
    });

    expect(outcome.status).toBe('recorded');
    // First query checks student active existence, second query is the atomic CTE
    expect(executedSql.length).toBe(2);
    expect(executedSql[0].query).toContain('FROM students WHERE id = $1');

    const sql = executedSql[1].query;

    // Must be a CTE starting with inserted_attempt
    expect(sql).toContain('WITH inserted_attempt AS');
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    // Must accumulate attempts atomically only from inserted_attempt
    expect(sql).toContain('attempts = activity_progress.attempts + 1');
    expect(sql).toContain('correct_attempts = activity_progress.correct_attempts + EXCLUDED.correct_attempts');
    expect(sql).toContain('incorrect_attempts = activity_progress.incorrect_attempts + EXCLUDED.incorrect_attempts');
    expect(sql).toContain('retry_count = activity_progress.retry_count + EXCLUDED.retry_count');
    expect(sql).toContain('first_attempt_correct = CASE');
    expect(sql).toContain('EXCLUDED.last_attempted_at >= activity_progress.last_attempted_at');
  });

  it('getStudentsFromDb filters by school_id when provided (school scoping)', async () => {
    await getStudentsFromDb('school_xyz');
    expect(executedSql.length).toBe(1);
    expect(executedSql[0].query).toContain('WHERE school_id = $1');
    expect(executedSql[0].params).toEqual(['school_xyz']);

    // When schoolId is not provided, returns all students (super_admin)
    executedSql = [];
    await getStudentsFromDb();
    expect(executedSql.length).toBe(1);
    expect(executedSql[0].query).not.toContain('WHERE school_id');
  });
});
