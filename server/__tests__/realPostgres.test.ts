// @vitest-environment node
/**
 * Real PostgreSQL Integration Tests.
 *
 * Runs strictly against an isolated temporary Neon branch specified by
 * process.env.TEST_DATABASE_URL.
 *
 * Requirements:
 *   1. Must use ONLY process.env.TEST_DATABASE_URL and skip (describe.skip) when unset.
 *      Never falls back to DATABASE_URL.
 *   2. Must throw if TEST_DATABASE_URL === DATABASE_URL.
 *   3. Out-of-order attempts CTE:
 *      (a) attempt 2 (correct) arrives before attempt 1 (wrong) -> first_attempt_correct = false, final_correct = true
 *      (b) an older wrong attempt arriving after a newer correct one does not change final_correct
 *   4. Single-CTE attempt & progress idempotency (sending duplicate attempt returns status: 'duplicate')
 *   5. Returns { status: 'not_found' } when student is archived or missing
 *   6. Foreign key ON DELETE RESTRICT enforcement
 *   7. Composite school consistency
 *   8. Admins role / school_id CHECK constraint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { runMigrations, recordAttemptInDb, setDb, archiveStudentInDb } from '../db';
import { generateClassCode } from '../classCode';

const testDbUrl = process.env.TEST_DATABASE_URL;
const mainDbUrl = process.env.DATABASE_URL;

// Refuse to run if TEST_DATABASE_URL equals DATABASE_URL
if (testDbUrl && mainDbUrl && testDbUrl.trim() === mainDbUrl.trim()) {
  throw new Error('FATAL: TEST_DATABASE_URL must not equal DATABASE_URL. Real tests require an isolated test branch!');
}

const shouldRun = Boolean(testDbUrl && (!mainDbUrl || testDbUrl.trim() !== mainDbUrl.trim()));
const suiteDescribe = shouldRun ? describe : describe.skip;

suiteDescribe('Real PostgreSQL Integration on Temporary Neon Branch', () => {
  let sql: NeonQueryFunction<false, false>;

  beforeAll(async () => {
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);
  }, 30000);

  afterAll(() => {
    setDb(null);
  });

  it('Requirement 4 & Status: sending attempt returns status recorded, duplicate returns duplicate, counters equal 1', async () => {
    const schoolId = `sch_test_${Date.now()}`;
    const classId = `cls_test_${Date.now()}`;
    const studentId = `stud_test_${Date.now()}`;
    const activityId = `act_test_counting`;
    const attemptId = `att_client_${Date.now()}`;

    // Setup school, class, student
    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'Test School');`, [schoolId]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 2B', 'Class 2', $3);`,
      [classId, schoolId, generateClassCode()]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'Kavitha', '01', 'avatar_1');`,
      [studentId, schoolId, classId]
    );

    const attemptPayload = {
      id: attemptId,
      studentId,
      activityId,
      category: 'word-completion',
      attemptNumber: 1,
      result: 'correct',
      completed: true,
      timestamp: new Date().toISOString(),
    };

    // Send attempt 1st time -> recorded
    const r1 = await recordAttemptInDb(attemptPayload);
    expect(r1.status).toBe('recorded');

    // Send the EXACT SAME attempt id a 2nd time -> duplicate
    const r2 = await recordAttemptInDb(attemptPayload);
    expect(r2.status).toBe('duplicate');

    // Send the EXACT SAME attempt id a 3rd time -> duplicate
    const r3 = await recordAttemptInDb(attemptPayload);
    expect(r3.status).toBe('duplicate');

    // 1. Verify attempts table has exactly 1 row
    const attempts = (await sql.query(
      `SELECT * FROM attempts WHERE id = $1;`,
      [attemptId]
    )) as Array<{ id: string; student_id: string; result: string }>;
    expect(attempts.length).toBe(1);

    // 2. Verify activity_progress counters equal 1
    const progress = (await sql.query(
      `SELECT * FROM activity_progress WHERE student_id = $1 AND activity_id = $2;`,
      [studentId, activityId]
    )) as Array<{
      attempts: number;
      correct_attempts: number;
      incorrect_attempts: number;
      retry_count: number;
      completed: boolean;
      correct: boolean;
      first_attempt_correct: boolean | null;
      final_correct: boolean | null;
    }>;

    expect(progress.length).toBe(1);
    expect(progress[0].attempts).toBe(1);
    expect(progress[0].correct_attempts).toBe(1);
    expect(progress[0].incorrect_attempts).toBe(0);
    expect(progress[0].retry_count).toBe(0);
    expect(progress[0].completed).toBe(true);
    expect(progress[0].correct).toBe(true);
    expect(progress[0].first_attempt_correct).toBe(true);
    expect(progress[0].final_correct).toBe(true);
  });

  it('Requirement 2 (a): attempt 2 (correct) arrives before attempt 1 (wrong) -> first_attempt_correct = false, final_correct = true', async () => {
    const schoolId = `sch_order_a_${Date.now()}`;
    const classId = `cls_order_a_${Date.now()}`;
    const studentId = `stud_order_a_${Date.now()}`;
    const activityId = `act_order_a`;

    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'Order School A');`, [schoolId]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 2A', 'Class 2', $3);`,
      [classId, schoolId, generateClassCode()]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'Student A', '10', 'avatar_1');`,
      [studentId, schoolId, classId]
    );

    const t1 = new Date(Date.now() - 60000).toISOString(); // 1 minute ago (older)
    const t2 = new Date(Date.now()).toISOString();         // now (newer)

    // Attempt 2 arrives FIRST (correct)
    const r2 = await recordAttemptInDb({
      id: `att_order_2_${Date.now()}`,
      studentId,
      activityId,
      category: 'spelling-choice',
      attemptNumber: 2,
      result: 'correct',
      completed: true,
      timestamp: t2,
    });
    expect(r2.status).toBe('recorded');

    // Attempt 1 arrives SECOND (wrong, but timestamp is older)
    const r1 = await recordAttemptInDb({
      id: `att_order_1_${Date.now()}`,
      studentId,
      activityId,
      category: 'spelling-choice',
      attemptNumber: 1,
      result: 'incorrect',
      completed: false,
      timestamp: t1,
    });
    expect(r1.status).toBe('recorded');

    const progress = (await sql.query(
      `SELECT * FROM activity_progress WHERE student_id = $1 AND activity_id = $2;`,
      [studentId, activityId]
    )) as Array<{
      attempts: number;
      correct_attempts: number;
      incorrect_attempts: number;
      first_attempt_correct: boolean | null;
      final_correct: boolean | null;
      correct: boolean | null;
    }>;

    expect(progress.length).toBe(1);
    expect(progress[0].attempts).toBe(2);
    expect(progress[0].correct_attempts).toBe(1);
    expect(progress[0].incorrect_attempts).toBe(1);
    // first_attempt_correct came from attempt_number = 1 -> false
    expect(progress[0].first_attempt_correct).toBe(false);
    // final_correct remains true from the newer attempt 2 (t2 > t1)
    expect(progress[0].final_correct).toBe(true);
    expect(progress[0].correct).toBe(true);
  });

  it('Requirement 2 (b): an older wrong attempt arriving after a newer correct one does not change final_correct', async () => {
    const schoolId = `sch_order_b_${Date.now()}`;
    const classId = `cls_order_b_${Date.now()}`;
    const studentId = `stud_order_b_${Date.now()}`;
    const activityId = `act_order_b`;

    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'Order School B');`, [schoolId]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 2B', 'Class 2', $3);`,
      [classId, schoolId, generateClassCode()]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'Student B', '11', 'avatar_1');`,
      [studentId, schoolId, classId]
    );

    const tNewer = new Date(Date.now()).toISOString();
    const tOlder = new Date(Date.now() - 120000).toISOString();

    // 1. Newer correct attempt recorded
    const rNew = await recordAttemptInDb({
      id: `att_b_new_${Date.now()}`,
      studentId,
      activityId,
      category: 'meaning-match',
      attemptNumber: 2,
      result: 'correct',
      completed: true,
      timestamp: tNewer,
    });
    expect(rNew.status).toBe('recorded');

    // Verify final_correct is true
    let progress = (await sql.query(
      `SELECT final_correct, correct FROM activity_progress WHERE student_id = $1 AND activity_id = $2;`,
      [studentId, activityId]
    )) as Array<{ final_correct: boolean; correct: boolean }>;
    expect(progress[0].final_correct).toBe(true);

    // 2. Older wrong attempt arrives later
    const rOld = await recordAttemptInDb({
      id: `att_b_old_${Date.now()}`,
      studentId,
      activityId,
      category: 'meaning-match',
      attemptNumber: 1,
      result: 'incorrect',
      completed: false,
      timestamp: tOlder,
    });
    expect(rOld.status).toBe('recorded');

    // Verify final_correct is STILL true
    progress = (await sql.query(
      `SELECT final_correct, correct FROM activity_progress WHERE student_id = $1 AND activity_id = $2;`,
      [studentId, activityId]
    )) as Array<{ final_correct: boolean; correct: boolean }>;
    expect(progress[0].final_correct).toBe(true);
    expect(progress[0].correct).toBe(true);
  });

  it('Requirement 3: returns not_found for non-existent student or archived student', async () => {
    // Non-existent student
    const rNonExistent = await recordAttemptInDb({
      id: `att_missing_${Date.now()}`,
      studentId: `stud_does_not_exist_${Date.now()}`,
      activityId: 'act_1',
      attemptNumber: 1,
      result: 'correct',
      completed: true,
      timestamp: new Date().toISOString(),
    });
    expect(rNonExistent.status).toBe('not_found');

    // Archived student
    const schoolId = `sch_arch_${Date.now()}`;
    const classId = `cls_arch_${Date.now()}`;
    const studentId = `stud_arch_${Date.now()}`;

    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'Archived School');`, [schoolId]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 3A', 'Class 3', $3);`,
      [classId, schoolId, generateClassCode()]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'Archived Student', '12', 'avatar_1');`,
      [studentId, schoolId, classId]
    );

    // Archive student
    await archiveStudentInDb(studentId);

    const rArchived = await recordAttemptInDb({
      id: `att_arch_${Date.now()}`,
      studentId,
      activityId: 'act_1',
      attemptNumber: 1,
      result: 'correct',
      completed: true,
      timestamp: new Date().toISOString(),
    });
    expect(rArchived.status).toBe('not_found');
  });

  it('Requirement 1 & 2: ON DELETE RESTRICT prevents deleting referenced parents', async () => {
    const schoolId = `sch_restrict_${Date.now()}`;
    const classId = `cls_restrict_${Date.now()}`;
    const studentId = `stud_restrict_${Date.now()}`;

    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'Restrict School');`, [schoolId]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 3A', 'Class 3', $3);`,
      [classId, schoolId, generateClassCode()]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'Ravi', '02', 'avatar_2');`,
      [studentId, schoolId, classId]
    );

    // Attempting to delete school must fail due to ON DELETE RESTRICT on classes
    await expect(sql.query(`DELETE FROM schools WHERE id = $1;`, [schoolId])).rejects.toThrow();

    // Attempting to delete class must fail due to ON DELETE RESTRICT on students
    await expect(sql.query(`DELETE FROM classes WHERE id = $1;`, [classId])).rejects.toThrow();
  });

  it('Requirement 3: composite foreign key prevents assigning student to a class from another school', async () => {
    const schoolA = `sch_a_${Date.now()}`;
    const schoolB = `sch_b_${Date.now()}`;
    const classA = `cls_a_${Date.now()}`;
    const student = `stud_cross_${Date.now()}`;

    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'School A');`, [schoolA]);
    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'School B');`, [schoolB]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class A', 'Class 2', $3);`,
      [classA, schoolA, generateClassCode()]
    );

    // Mismatched school: class belongs to schoolA, but student claims schoolB
    // (class_id, school_id) constraint must reject this
    await expect(
      sql.query(
        `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar)
         VALUES ($1, $2, $3, 'Cross School Student', '99', 'avatar_default');`,
        [student, schoolB, classA]
      )
    ).rejects.toThrow();
  });

  it('Requirement 2: admins CHECK constraint rejects school_admin without school and super_admin with school', async () => {
    const schoolId = `sch_admin_${Date.now()}`;
    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'Admin School');`, [schoolId]);

    // school_admin with NULL school_id -> MUST FAIL
    await expect(
      sql.query(
        `INSERT INTO admins (id, username, password_hash, role, school_id)
         VALUES ('adm_invalid_1', $1, 'hash', 'school_admin', NULL);`,
        [`admin_null_school_${Date.now()}`]
      )
    ).rejects.toThrow();

    // super_admin with non-null school_id -> MUST FAIL
    await expect(
      sql.query(
        `INSERT INTO admins (id, username, password_hash, role, school_id)
         VALUES ('adm_invalid_2', $1, 'hash', 'super_admin', $2);`,
        [`super_with_school_${Date.now()}`, schoolId]
      )
    ).rejects.toThrow();

    // Valid super_admin (school_id NULL) -> SUCCEEDS
    const superAdmin = (await sql.query(
      `INSERT INTO admins (id, username, password_hash, role, school_id)
       VALUES ('adm_valid_super_${Date.now()}', $1, 'hash', 'super_admin', NULL) RETURNING id;`,
      [`valid_super_${Date.now()}`]
    )) as Array<{ id: string }>;
    expect(superAdmin.length).toBe(1);

    // Valid school_admin (school_id NOT NULL) -> SUCCEEDS
    const schoolAdmin = (await sql.query(
      `INSERT INTO admins (id, username, password_hash, role, school_id)
       VALUES ('adm_valid_school_${Date.now()}', $1, 'hash', 'school_admin', $2) RETURNING id;`,
      [`valid_school_${Date.now()}`, schoolId]
    )) as Array<{ id: string }>;
    expect(schoolAdmin.length).toBe(1);
  });
});
