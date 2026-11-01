// @vitest-environment node
/**
 * T8. Real PostgreSQL Integration Test on Temporary Neon Branch:
 * - current_index never decreases (monotonic progression).
 * - A 'completed' session never returns to 'active'.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const prodDatabaseUrl = process.env.DATABASE_URL;

const isConfigured = Boolean(testDatabaseUrl && testDatabaseUrl.trim().length > 0);

if (isConfigured && testDatabaseUrl === prodDatabaseUrl) {
  throw new Error(
    'CRITICAL SAFETY ERROR: TEST_DATABASE_URL must NOT be identical to DATABASE_URL!'
  );
}

const runOrSkip = isConfigured ? describe : describe.skip;

runOrSkip('T8: Monotonic forward-only current_index & terminal completed status in PostgreSQL', () => {
  let sql: ReturnType<typeof neon>;
  const testStudentId = `stud_t8_${Date.now()}`;
  const testSchoolId = 'school_unassigned';
  const testClassId = 'class_legacy';
  const testSessionId = `sess_t8_${Date.now()}`;

  beforeAll(async () => {
    sql = neon(testDatabaseUrl!);
    const { setDb } = await import('../db');
    setDb(sql as unknown as Parameters<typeof setDb>[0]);

    // Insert student
    await sql`
      INSERT INTO students (id, school_id, class_id, name, roll_no, avatar)
      VALUES (${testStudentId}, ${testSchoolId}, ${testClassId}, 'T8 Student', 'T8-01', 'avatar_sun')
      ON CONFLICT (id) DO NOTHING;
    `;

    // Insert session at current_index = 5
    await sql`
      INSERT INTO learning_sessions (
        id, school_id, student_id, subject, category_or_module, activity_ids, current_index, status
      )
      VALUES (
        ${testSessionId}, ${testSchoolId}, ${testStudentId}, 'tamil', 'spelling-choice',
        '["Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9","Q10"]'::jsonb, 5, 'active'
      )
      ON CONFLICT (id) DO NOTHING;
    `;
  });

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM learning_sessions WHERE id = ${testSessionId};`;
      await sql`DELETE FROM students WHERE id = ${testStudentId};`;
    }
    const { setDb } = await import('../db');
    setDb(null as unknown as Parameters<typeof setDb>[0]);
  });

  it('current_index never decreases: update with smaller index leaves it unchanged', async () => {
    const { updateSessionProgressInDb } = await import('../db');

    // Attempt to set current_index to 2 (backward from 5)
    const updated = await updateSessionProgressInDb({
      sessionId: testSessionId,
      studentId: testStudentId,
      currentIndex: 2,
    });

    expect(updated).not.toBeNull();
    // Must remain 5! Never decrease!
    expect(updated!.current_index, 'current_index must not decrease').toBe(5);

    // Advancing forward to 7 must succeed
    const advanced = await updateSessionProgressInDb({
      sessionId: testSessionId,
      studentId: testStudentId,
      currentIndex: 7,
    });
    expect(advanced!.current_index).toBe(7);
  });

  it('a completed session never returns to active', async () => {
    const { updateSessionProgressInDb } = await import('../db');

    // Mark completed
    const completed = await updateSessionProgressInDb({
      sessionId: testSessionId,
      studentId: testStudentId,
      status: 'completed',
    });
    expect(completed!.status).toBe('completed');

    // Attempt to reactivate session with status = 'active'
    const reactivated = await updateSessionProgressInDb({
      sessionId: testSessionId,
      studentId: testStudentId,
      status: 'active',
      currentIndex: 1,
    });

    expect(reactivated!.status, 'Terminal completed session must not return to active').toBe('completed');
  });
});
