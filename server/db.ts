import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { generateClassCode } from './classCode';
import { lookupActivityMetadata, allActivityMetadata } from './activityCatalog';
import type {
  AdminDashboardMetrics,
  StudentProgressSummary,
  StudentDetailedProgress,
  StudentCategoryMastery,
  StudentModuleProgress,
  QuestionAttemptDetail,
} from '../src/admin/types';
import type { ActivityCategory } from '../src/types';

// â”€â”€ Connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let sqlInstance: NeonQueryFunction<false, false> | null = null;

export function setDb(instance: NeonQueryFunction<false, false> | null): void {
  sqlInstance = instance;
}

export function getDb(): NeonQueryFunction<false, false> {
  if (!sqlInstance) {
    const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. ' +
          'Provide it via environment variables before starting the server.'
      );
    }
    sqlInstance = neon(connectionString);
  }
  return sqlInstance;
}

// â”€â”€ SQL Statement Splitter (Preserves DO $$ ... $$ blocks) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let inSingleQuote = false;
  let i = 0;

  const lines = sqlText.split('\n');
  const cleaned = lines
    .map((line) => (line.trim().startsWith('--') ? '' : line))
    .join('\n');

  while (i < cleaned.length) {
    const char = cleaned[i];
    const nextChar = cleaned[i + 1];

    if (!inDollarQuote && char === "'" && (i === 0 || cleaned[i - 1] !== '\\')) {
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
      continue;
    }

    if (!inSingleQuote && char === '$' && nextChar === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i += 2;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote && char === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  const last = current.trim();
  if (last.length > 0) {
    statements.push(last);
  }

  return statements;
}

// â”€â”€ Migration Runner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function runMigrations(customDb?: NeonQueryFunction<false, false>): Promise<void> {
  const sql = customDb || getDb();

  await sql.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRows = (await sql.query(`SELECT id FROM _migrations;`)) as Array<{ id: string }>;
  const appliedSet = new Set(appliedRows.map((r) => r.id));

  const migrations = [
    { id: '001_schema', file: path.resolve(process.cwd(), 'server', 'schema.sql') },
    { id: '002_attempts_backfill', file: path.resolve(process.cwd(), 'server', 'migrations', 'attempts_metadata_backfill.sql') },
    { id: '003_assessment_tracking', file: path.resolve(process.cwd(), 'server', 'migrations', '003_assessment_tracking.sql') },
    { id: '004_remove_classes', file: path.resolve(process.cwd(), 'server', 'migrations', '004_remove_classes.sql') },
  ];

  for (const migration of migrations) {
    if (appliedSet.has(migration.id)) {
      continue;
    }
    const statements = splitSqlStatements(fs.readFileSync(migration.file, 'utf8'));
    for (const statement of statements) {
      await sql.query(statement);
    }
    await sql.query(`INSERT INTO _migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING;`, [migration.id]);
  }
}

// â”€â”€ Type rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface SchoolRow {
  id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
}

export interface ClassRow {
  id: string;
  school_id: string;
  name: string;
  grade: string;
  class_code: string;
  created_at: string;
  archived_at: string | null;
}

export interface StudentRow {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  roll_no: string;
  avatar: string;
  pin_hash: string | null;
  failed_pin_attempts: number;
  locked_until: string | null;
  created_at: string;
  last_active_at: string;
  archived_at: string | null;
}

export interface LearningSessionRow {
  id: string;
  school_id: string;
  student_id: string;
  subject: 'tamil' | 'english';
  category_or_module: string;
  activity_ids: string[];
  current_index: number;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
}

export interface ProgressRow {
  student_id: string;
  school_id: string;
  activity_id: string;
  category: string;
  completed: boolean;
  correct: boolean;
  attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  retry_count: number;
  first_attempt_correct: boolean | null;
  final_correct: boolean | null;
  last_completed_at: string | null;
  last_attempted_at: string;
}

export interface AttemptRow {
  id: string;
  student_id: string;
  school_id: string;
  activity_id: string;
  category: string | null;
  attempt_number: number;
  result: string;
  completed: boolean;
  timestamp: string;
  subject: 'english' | 'tamil' | null;
  module_id: number | null;
  grade: number | null;
}

export interface AdminRow {
  id: string;
  username: string;
  password_hash: string;
  role: 'super_admin' | 'school_admin';
  school_id: string | null;
  failed_attempts: number;
  locked_until: string | null;
}

// â”€â”€ School & Class operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getSchoolsFromDb(): Promise<SchoolRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM schools WHERE archived_at IS NULL ORDER BY name ASC;'
  )) as SchoolRow[];
}

export async function createClassWithUniqueCode(
  classData: {
    id: string;
    schoolId: string;
    name: string;
    grade: string;
  },
  maxRetries: number = 8
): Promise<ClassRow> {
  const sql = getDb();

  // Prevent duplicate active class records within the same school
  const existing = (await sql.query(
    `SELECT * FROM classes
     WHERE school_id = $1
       AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       AND LOWER(TRIM(grade)) = LOWER(TRIM($3))
       AND archived_at IS NULL
     LIMIT 1;`,
    [classData.schoolId, classData.name, classData.grade]
  )) as ClassRow[];
  if (existing[0]) {
    return existing[0];
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const classCode = generateClassCode(6);
    try {
      const rows = (await sql.query(
        `INSERT INTO classes (id, school_id, name, grade, class_code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *;`,
        [classData.id, classData.schoolId, classData.name, classData.grade, classCode]
      )) as ClassRow[];
      return rows[0];
    } catch (err: unknown) {
      const isUniqueViolation =
        Boolean(err && typeof err === 'object' && (('code' in err && err.code === '23505') || 'constraint' in err));
      if (isUniqueViolation && attempt < maxRetries - 1) {
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to generate a unique class code after ${maxRetries} attempts`);
}

export async function getClassByCode(classCode: string): Promise<ClassRow | null> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT * FROM classes
     WHERE class_code = $1
       AND id != 'class_legacy'
       AND class_code != 'LEGACY'
       AND archived_at IS NULL
     LIMIT 1;`,
    [classCode.toUpperCase().trim()]
  )) as ClassRow[];
  return rows[0] ?? null;
}

export async function getClassById(classId: string): Promise<ClassRow | null> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT * FROM classes WHERE id = $1 AND archived_at IS NULL LIMIT 1;`,
    [classId]
  )) as ClassRow[];
  return rows[0] ?? null;
}

export async function getClassesForSchool(schoolId?: string | null): Promise<ClassRow[]> {
  const sql = getDb();
  if (schoolId) {
    return (await sql.query(
      `SELECT * FROM classes
       WHERE school_id = $1
         AND id != 'class_legacy'
         AND class_code != 'LEGACY'
         AND archived_at IS NULL
       ORDER BY name ASC;`,
      [schoolId]
    )) as ClassRow[];
  }
  return (await sql.query(
    `SELECT * FROM classes
     WHERE id != 'class_legacy'
       AND class_code != 'LEGACY'
       AND archived_at IS NULL
     ORDER BY name ASC;`
  )) as ClassRow[];
}

export async function archiveClassInDb(classId: string): Promise<void> {
  const sql = getDb();
  await sql.query('UPDATE classes SET archived_at = NOW() WHERE id = $1;', [classId]);
}

export async function getSchoolById(id: string): Promise<(SchoolRow & { school_name?: string; school_code?: string; academic_year?: string }) | null> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT *, COALESCE(school_name, name) AS school_name, COALESCE(school_code, id) AS school_code, COALESCE(academic_year, '2026-2027') AS academic_year
     FROM schools WHERE id = $1 LIMIT 1;`,
    [id]
  )) as Array<SchoolRow & { school_name?: string; school_code?: string; academic_year?: string }>;
  return rows[0] || null;
}

export async function getActiveSchoolsFromDb(): Promise<Array<{ id: string; name: string; schoolCode: string; academicYear: string }>> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT id, COALESCE(school_name, name) AS name, COALESCE(school_code, id) AS school_code, COALESCE(academic_year, '2026-2027') AS academic_year
     FROM schools
     WHERE archived_at IS NULL AND (is_active IS NULL OR is_active = TRUE)
     ORDER BY name ASC;`
  )) as Array<{ id: string; name: string; school_code: string; academic_year: string }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    schoolCode: r.school_code,
    academicYear: r.academic_year,
  }));
}

export async function getStudentsForSchoolRoster(
  schoolId: string
): Promise<Array<{ id: string; name: string; avatar: string; rollNumber: string; hasPin: boolean }>> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT id, name, avatar, COALESCE(roll_number, roll_no) AS roll_number, (pin_hash IS NOT NULL) AS has_pin
     FROM students
     WHERE school_id = $1 AND archived_at IS NULL
     ORDER BY COALESCE(roll_number, roll_no) ASC, name ASC;`,
    [schoolId]
  )) as Array<{ id: string; name: string; avatar: string; roll_number: string; has_pin: boolean }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    rollNumber: r.roll_number,
    hasPin: r.has_pin,
  }));
}

export async function getStudentsForClassRoster(
  classId: string
): Promise<Array<{ id: string; name: string; avatar: string }>> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT id, name, avatar FROM students
     WHERE class_id = $1 AND archived_at IS NULL
     ORDER BY name ASC;`,
    [classId]
  )) as Array<{ id: string; name: string; avatar: string }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name.trim().split(' ')[0],
    avatar: r.avatar,
  }));
}

export async function checkAndIncrementClassLookupRateLimit(
  ip: string,
  kind: 'invalid' | 'valid'
): Promise<{ allowed: boolean; remaining: number }> {
  const sql = getDb();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const maxLimit = kind === 'invalid' ? 10 : 300;

  const rows = (await sql.query(
    `INSERT INTO class_lookup_rate_limits (ip, kind, window_start, count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (ip, kind, window_start) DO UPDATE SET count = class_lookup_rate_limits.count + 1
     RETURNING count;`,
    [ip, kind, windowStart]
  )) as Array<{ count: number }>;

  const count = rows[0]?.count ?? 1;
  if (count > maxLimit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxLimit - count };
}

/** School of a student, archived or not; null if the student does not exist. Used for access scoping. */
export async function getStudentSchoolId(studentId: string): Promise<string | null> {
  const sql = getDb();
  const rows = (await sql.query('SELECT school_id FROM students WHERE id = $1 LIMIT 1;', [studentId])) as {
    school_id: string;
  }[];
  return rows[0]?.school_id ?? null;
}

export async function getStudentById(studentId: string): Promise<StudentRow | null> {
  const sql = getDb();
  const rows = (await sql.query(
    'SELECT * FROM students WHERE id = $1 AND archived_at IS NULL LIMIT 1;',
    [studentId]
  )) as StudentRow[];
  return rows[0] ?? null;
}

export async function unlockStudentPinInDb(studentId: string): Promise<void> {
  const sql = getDb();
  await sql.query(
    'UPDATE students SET failed_pin_attempts = 0, locked_until = NULL WHERE id = $1;',
    [studentId]
  );
}

export async function updateStudentPinInDb(studentId: string, pinHash: string): Promise<void> {
  const sql = getDb();
  await sql.query(
    'UPDATE students SET pin_hash = $1, failed_pin_attempts = 0, locked_until = NULL WHERE id = $2;',
    [pinHash, studentId]
  );
}

// â”€â”€ Student operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getStudentsFromDb(schoolId?: string | null): Promise<StudentRow[]> {
  const sql = getDb();
  if (schoolId) {
    return (await sql.query(
      'SELECT * FROM students WHERE school_id = $1 AND archived_at IS NULL ORDER BY last_active_at DESC;',
      [schoolId]
    )) as StudentRow[];
  }
  return (await sql.query(
    'SELECT * FROM students WHERE archived_at IS NULL ORDER BY last_active_at DESC;'
  )) as StudentRow[];
}

export async function upsertStudentInDb(student: {
  id: string;
  name: string;
  schoolId?: string;
  classId?: string | null;
  rollNo?: string;
  avatar?: string;
  pinHash?: string | null;
  createdAt?: string;
  lastActiveAt?: string;
}): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql.query(
    `INSERT INTO students (id, name, student_name, school_id, class_id, roll_no, roll_number, avatar, pin_hash, is_active, created_at, last_active_at)
     VALUES (
       $1,
       $2,
       $2,
       COALESCE($3, 'school_unassigned'),
       $4,
       COALESCE($5, $1),
       COALESCE($5, $1),
       COALESCE($6, 'avatar_default'),
       $7,
       TRUE,
       COALESCE($8::timestamptz, $9::timestamptz),
       COALESCE($9::timestamptz, $8::timestamptz)
     )
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       student_name = EXCLUDED.student_name,
       school_id = COALESCE(EXCLUDED.school_id, students.school_id),
       class_id = EXCLUDED.class_id,
       roll_no = COALESCE(EXCLUDED.roll_no, students.roll_no),
       roll_number = COALESCE(EXCLUDED.roll_number, students.roll_number),
       avatar = COALESCE(EXCLUDED.avatar, students.avatar),
       pin_hash = COALESCE(EXCLUDED.pin_hash, students.pin_hash),
       last_active_at = EXCLUDED.last_active_at;`,
    [
      student.id,
      student.name,
      student.schoolId ?? null,
      student.classId ?? null,
      student.rollNo ?? null,
      student.avatar ?? null,
      student.pinHash ?? null,
      student.createdAt ?? now,
      student.lastActiveAt ?? now,
    ]
  );
}

export async function archiveStudentInDb(id: string): Promise<void> {
  const sql = getDb();
  await sql.query('UPDATE students SET archived_at = NOW() WHERE id = $1;', [id]);
}

export async function deleteStudentFromDb(id: string): Promise<void> {
  // Hard delete remains for testing/cleanup, but production soft-deletes via archiveStudentInDb
  const sql = getDb();
  await sql.query('DELETE FROM students WHERE id = $1;', [id]);
}

// â”€â”€ Progress operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getProgressForStudentFromDb(
  studentId: string
): Promise<ProgressRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM activity_progress WHERE student_id = $1 ORDER BY last_attempted_at DESC;',
    [studentId]
  )) as ProgressRow[];
}

// â”€â”€ Attempt operations (Single CTE with Idempotent Progress Upsert) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Records an attempt with client-generated attempt id for idempotency.
 * Executes as ONE atomic SQL statement (a CTE):
 *   1. Inserts the attempt ON CONFLICT (id) DO NOTHING RETURNING ...
 *   2. Only if the attempt was inserted, upserts activity_progress with incremented counters.
 *   3. If the attempt was already recorded (same id), RETURNING yields 0 rows and NOTHING changes.
 *   4. Derives school_id directly from the student row in the DB, never from the client.
 *   5. Only updates progress fields (final_correct, last_attempted_at, etc.) if the attempt is newer
 *      than or equal to the existing last_attempted_at timestamp.
 *   6. Sets first_attempt_correct only when attempt_number = 1.
 */
export async function recordAttemptInDb(attempt: {
  id: string;
  studentId: string;
  activityId: string;
  category?: string;
  attemptNumber: number;
  result: string;
  completed: boolean;
  timestamp: string;
}): Promise<{ status: 'recorded' | 'duplicate' | 'not_found' }> {
  const sql = getDb();

  // Student check: must exist and not be archived
  const studentCheck = (await sql.query(
    'SELECT id, school_id, archived_at FROM students WHERE id = $1 LIMIT 1;',
    [attempt.studentId]
  )) as { id: string; school_id: string; archived_at: string | null }[];

  if (!studentCheck[0] || studentCheck[0].archived_at !== null) {
    return { status: 'not_found' };
  }

  const schoolId = studentCheck[0].school_id;

  // subject / module_id / grade come only from the content manifests, never from the client.
  // Unknown activity ids are still recorded, with NULL metadata.
  const meta = lookupActivityMetadata(attempt.activityId);

  const result = (await sql.query(
    `WITH inserted_attempt AS (
       INSERT INTO attempts (id, student_id, activity_id, category, attempt_number, result, completed, timestamp, school_id, subject, module_id, grade)
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
       )
       ON CONFLICT (id) DO NOTHING
       RETURNING id, student_id, school_id, activity_id, category, attempt_number, result, completed, timestamp
     ),
     upserted_progress AS (
       INSERT INTO activity_progress (
         student_id,
         school_id,
         activity_id,
         category,
         completed,
         correct,
         attempts,
         correct_attempts,
         incorrect_attempts,
         retry_count,
         first_attempt_correct,
         final_correct,
         last_completed_at,
         last_attempted_at
       )
       SELECT
         ia.student_id,
         ia.school_id,
         ia.activity_id,
         COALESCE(ia.category, 'unknown'),
         ia.completed,
         (ia.result = 'correct'),
         1,
         CASE WHEN ia.result = 'correct' THEN 1 ELSE 0 END,
         CASE WHEN ia.result != 'correct' THEN 1 ELSE 0 END,
         CASE WHEN ia.attempt_number > 1 THEN 1 ELSE 0 END,
         CASE WHEN ia.attempt_number = 1 THEN (ia.result = 'correct') ELSE NULL END,
         (ia.result = 'correct'),
         CASE WHEN ia.completed THEN ia.timestamp ELSE NULL END,
         ia.timestamp
       FROM inserted_attempt ia
       ON CONFLICT (student_id, activity_id) DO UPDATE SET
         category = COALESCE(EXCLUDED.category, activity_progress.category),
         attempts = activity_progress.attempts + 1,
         correct_attempts = activity_progress.correct_attempts + EXCLUDED.correct_attempts,
         incorrect_attempts = activity_progress.incorrect_attempts + EXCLUDED.incorrect_attempts,
         retry_count = activity_progress.retry_count + EXCLUDED.retry_count,
         first_attempt_correct = CASE
           WHEN EXCLUDED.first_attempt_correct IS NOT NULL THEN EXCLUDED.first_attempt_correct
           ELSE activity_progress.first_attempt_correct
         END,
         completed = CASE
           WHEN activity_progress.last_attempted_at IS NULL OR EXCLUDED.last_attempted_at >= activity_progress.last_attempted_at
             THEN (activity_progress.completed OR EXCLUDED.completed)
           ELSE activity_progress.completed
         END,
         correct = CASE
           WHEN activity_progress.last_attempted_at IS NULL OR EXCLUDED.last_attempted_at >= activity_progress.last_attempted_at
             THEN EXCLUDED.correct
           ELSE activity_progress.correct
         END,
         final_correct = CASE
           WHEN activity_progress.last_attempted_at IS NULL OR EXCLUDED.last_attempted_at >= activity_progress.last_attempted_at
             THEN EXCLUDED.final_correct
           ELSE activity_progress.final_correct
         END,
         last_completed_at = CASE
           WHEN EXCLUDED.completed AND (activity_progress.last_completed_at IS NULL OR EXCLUDED.last_attempted_at >= activity_progress.last_completed_at)
             THEN EXCLUDED.last_attempted_at
           ELSE activity_progress.last_completed_at
         END,
         last_attempted_at = CASE
           WHEN activity_progress.last_attempted_at IS NULL OR EXCLUDED.last_attempted_at >= activity_progress.last_attempted_at
             THEN EXCLUDED.last_attempted_at
           ELSE activity_progress.last_attempted_at
         END
       RETURNING activity_progress.activity_id
     )
     SELECT id FROM inserted_attempt;`,
    [
      attempt.id,
      attempt.studentId,
      attempt.activityId,
      attempt.category ?? null,
      attempt.attemptNumber,
      attempt.result,
      attempt.completed,
      attempt.timestamp,
      schoolId,
      meta?.subject ?? null,
      meta?.moduleId ?? null,
      meta?.grade ?? null,
    ]
  )) as { id: string }[];

  if (result.length === 1) {
    return { status: 'recorded' };
  }

  // If inserted_attempt returned 0 rows, check if it was due to conflict on (id)
  const existingAttempt = (await sql.query(
    'SELECT id FROM attempts WHERE id = $1 LIMIT 1;',
    [attempt.id]
  )) as { id: string }[];

  if (existingAttempt.length > 0) {
    return { status: 'duplicate' };
  }

  return { status: 'not_found' };
}

export async function getAttemptsForStudentFromDb(
  studentId: string
): Promise<AttemptRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM attempts WHERE student_id = $1 ORDER BY timestamp ASC;',
    [studentId]
  )) as AttemptRow[];
}

// â”€â”€ Admin operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getAdminByUsername(
  username: string
): Promise<AdminRow | null> {
  const sql = getDb();
  const rows = (await sql.query(
    'SELECT * FROM admins WHERE username ILIKE $1 LIMIT 1;',
    [username]
  )) as AdminRow[];
  return rows[0] ?? null;
}

export async function incrementAdminFailedAttempts(adminId: string): Promise<void> {
  const sql = getDb();
  await sql.query(
    `UPDATE admins
     SET failed_attempts = failed_attempts + 1,
         locked_until = CASE
           WHEN failed_attempts + 1 >= 5
           THEN NOW() + INTERVAL '15 minutes'
           ELSE locked_until
         END
     WHERE id = $1;`,
    [adminId]
  );
}

export async function resetAdminFailedAttempts(adminId: string): Promise<void> {
  const sql = getDb();
  await sql.query(
    `UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = $1;`,
    [adminId]
  );
}

export async function upsertAdminInDb(admin: {
  id: string;
  username: string;
  passwordHash: string;
  role: 'super_admin' | 'school_admin';
  schoolId: string | null;
}): Promise<void> {
  const sql = getDb();
  await sql.query(
    `INSERT INTO admins (id, username, password_hash, role, school_id, failed_attempts)
     VALUES ($1, $2, $3, $4, $5, 0)
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       school_id = EXCLUDED.school_id,
       failed_attempts = 0,
       locked_until = NULL;`,
    [admin.id, admin.username, admin.passwordHash, admin.role, admin.schoolId]
  );
}

// â”€â”€ Phase 4: Learning Session DB Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface SessionRow {
  id: string;
  school_id: string;
  student_id: string;
  subject: string;
  category_or_module: string;
  activity_ids: string[];
  current_index: number;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
}

export async function getActiveSessionForStudentFromDb(
  studentId: string,
  subject?: string,
  categoryOrModule?: string
): Promise<SessionRow | null> {
  const sql = getDb();
  let query = 'SELECT * FROM learning_sessions WHERE student_id = $1 AND status = \'active\'';
  const params: unknown[] = [studentId];

  if (subject) {
    params.push(subject.toLowerCase());
    query += ` AND subject = $${params.length}`;
  }
  if (categoryOrModule) {
    params.push(categoryOrModule);
    query += ` AND category_or_module = $${params.length}`;
  }

  query += ' ORDER BY updated_at DESC LIMIT 1;';
  const rows = (await sql.query(query, params)) as SessionRow[];
  if (!rows[0]) return null;

  const row = { ...rows[0] };
  if (typeof row.activity_ids === 'string') {
    row.activity_ids = JSON.parse(row.activity_ids);
  }
  return row;
}

export async function getSessionByIdFromDb(sessionId: string): Promise<SessionRow | null> {
  const sql = getDb();
  const rows = (await sql.query(
    'SELECT * FROM learning_sessions WHERE id = $1 LIMIT 1;',
    [sessionId]
  )) as SessionRow[];
  if (!rows[0]) return null;

  const row = { ...rows[0] };
  if (typeof row.activity_ids === 'string') {
    row.activity_ids = JSON.parse(row.activity_ids);
  }
  return row;
}

export async function upsertActiveSessionInDb(params: {
  id: string;
  studentId: string;
  subject: 'tamil' | 'english';
  categoryOrModule: string;
  activityIds: string[];
  currentIndex?: number;
}): Promise<SessionRow> {
  const sql = getDb();

  // Derive school_id from student record to enforce integrity
  const studentRows = (await sql.query(
    'SELECT school_id FROM students WHERE id = $1 AND archived_at IS NULL LIMIT 1;',
    [params.studentId]
  )) as Array<{ school_id: string }>;

  if (!studentRows[0]) {
    throw new Error('Student not found or archived');
  }
  const schoolId = studentRows[0].school_id;

  const activityIdsJson = JSON.stringify(params.activityIds);
  const currentIndex = params.currentIndex ?? 0;

  const query = `
    INSERT INTO learning_sessions (
      id, school_id, student_id, subject, category_or_module, activity_ids, current_index, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'active', NOW(), NOW())
    ON CONFLICT (student_id, subject, category_or_module) WHERE status = 'active'
    DO UPDATE SET
      activity_ids = EXCLUDED.activity_ids,
      current_index = EXCLUDED.current_index,
      updated_at = NOW()
    RETURNING *;
  `;

  const rows = (await sql.query(query, [
    params.id,
    schoolId,
    params.studentId,
    params.subject.toLowerCase(),
    params.categoryOrModule,
    activityIdsJson,
    currentIndex,
  ])) as SessionRow[];

  const row = { ...rows[0] };
  if (typeof row.activity_ids === 'string') {
    row.activity_ids = JSON.parse(row.activity_ids);
  }
  return row;
}

export async function updateSessionProgressInDb(params: {
  sessionId: string;
  studentId: string;
  currentIndex?: number;
  status?: 'active' | 'completed' | 'abandoned';
}): Promise<SessionRow | null> {
  const sql = getDb();

  const updates: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [params.sessionId, params.studentId];

  if (params.currentIndex !== undefined) {
    values.push(params.currentIndex);
    updates.push(`current_index = GREATEST(learning_sessions.current_index, $${values.length})`);
  }
  if (params.status !== undefined) {
    values.push(params.status);
    updates.push(
      `status = CASE WHEN learning_sessions.status = 'completed' THEN 'completed' ELSE $${values.length} END`
    );
  }

  const query = `
    UPDATE learning_sessions
    SET ${updates.join(', ')}
    WHERE id = $1 AND student_id = $2
    RETURNING *;
  `;

  const rows = (await sql.query(query, values)) as SessionRow[];
  if (!rows[0]) return null;

  const row = { ...rows[0] };
  if (typeof row.activity_ids === 'string') {
    row.activity_ids = JSON.parse(row.activity_ids);
  }
  return row;
}

// â”€â”€ Admin Dashboard & Progress Aggregations (School-Scoped SQL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'picture-recognition': 'à®ªà®Ÿà®®à¯ à®ªà®¾à®°à¯à®¤à¯à®¤à¯ à®šà¯Šà®²à¯ (Picture Recognition)',
  'word-completion': 'à®šà¯Šà®²à¯ à®¨à®¿à®°à®ªà¯à®ªà¯à®• (Word Completion)',
  'arrange-word': 'à®šà¯Šà®²à¯ à®‰à®°à¯à®µà®¾à®•à¯à®•à¯à®• (Arrange Word)',
  'spelling-choice': 'à®šà®°à®¿à®¯à®¾à®© à®Žà®´à¯à®¤à¯à®¤à¯à®•à¯à®•à¯‚à®Ÿà¯à®Ÿà®²à¯ (Spelling Choice)',
  'context-choice': 'à®µà®¾à®•à¯à®•à®¿à®¯à®ªà¯ à®ªà®¯à®¿à®±à¯à®šà®¿ (Context Choice)',
  'meaning-match': 'à®ªà¯Šà®°à¯à®³à¯ à®…à®±à®¿à®µà¯‹à®®à¯ (Meaning Match)',
};

export async function getAdminDashboardMetrics(schoolId?: string): Promise<AdminDashboardMetrics> {
  const sql = getDb();
  const rows = (await sql.query(
    `WITH scoped_students AS (
       SELECT id
       FROM students
       WHERE archived_at IS NULL
         AND ($1::text IS NULL OR school_id = $1::text)
     ),
     student_metrics AS (
       SELECT
         ap.student_id,
         COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.attempts > 0 OR ap.completed) AS questions_attempted,
         COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.completed) AS questions_completed,
         COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.completed AND ap.first_attempt_correct = TRUE) AS first_attempt_successes,
         COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.retry_count > 0) AS questions_retried,
         COALESCE(SUM(ap.retry_count), 0) AS total_retries
       FROM activity_progress ap
       JOIN scoped_students s ON s.id = ap.student_id
       GROUP BY ap.student_id
     )
     SELECT
       (SELECT COUNT(*)::int FROM scoped_students) AS total_students,
       COALESCE((SELECT COUNT(*)::int FROM student_metrics WHERE questions_attempted > 0), 0) AS active_students,
       COALESCE(SUM(questions_completed), 0)::int AS total_activities_completed,
       COALESCE(SUM(questions_completed), 0)::int AS total_questions_completed,
       COALESCE(SUM(first_attempt_successes), 0)::int AS first_attempt_successes,
       COALESCE(SUM(questions_retried), 0)::int AS questions_retried,
       COALESCE(SUM(total_retries), 0)::int AS total_retries
     FROM student_metrics;`,
    [schoolId ?? null]
  )) as Array<{
    total_students: number;
    active_students: number;
    total_activities_completed: number;
    total_questions_completed: number;
    first_attempt_successes: number;
    questions_retried: number;
    total_retries: number;
  }>;

  const r = rows[0] || {
    total_students: 0,
    active_students: 0,
    total_activities_completed: 0,
    total_questions_completed: 0,
    first_attempt_successes: 0,
    questions_retried: 0,
    total_retries: 0,
  };

  return {
    totalStudents: Number(r.total_students) || 0,
    activeStudents: Number(r.active_students) || 0,
    totalActivitiesCompleted: Number(r.total_activities_completed) || 0,
    totalQuestionsCompleted: Number(r.total_questions_completed) || 0,
    firstAttemptSuccesses: Number(r.first_attempt_successes) || 0,
    questionsRetried: Number(r.questions_retried) || 0,
    totalRetries: Number(r.total_retries) || 0,
  };
}

export async function getAdminStudentSummaries(schoolId?: string): Promise<StudentProgressSummary[]> {
  const sql = getDb();
  const totalActivities = allActivityMetadata().length || 1;

  const rows = (await sql.query(
    `SELECT
       s.id AS student_id,
       s.name AS student_name,
       s.created_at,
       s.last_active_at,
       COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.completed)::int AS activities_completed,
       COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.attempts > 0 OR ap.completed)::int AS total_questions_attempted,
       COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.completed)::int AS questions_completed,
       COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.completed AND ap.first_attempt_correct = TRUE)::int AS first_attempt_correct_count,
       COUNT(DISTINCT ap.activity_id) FILTER (WHERE ap.retry_count > 0)::int AS questions_retried_count,
       COALESCE(SUM(ap.retry_count), 0)::int AS total_retries_count,
       (
         SELECT json_build_object(
           'subject', ls.subject,
           'categoryOrModule', ls.category_or_module,
           'currentIndex', ls.current_index,
           'total', jsonb_array_length(ls.activity_ids),
           'label', 'Question ' || (ls.current_index + 1) || ' of ' || jsonb_array_length(ls.activity_ids)
         )
         FROM learning_sessions ls
         WHERE ls.student_id = s.id AND ls.status = 'active'
         ORDER BY ls.updated_at DESC
         LIMIT 1
       ) AS active_session_info
     FROM students s
     LEFT JOIN activity_progress ap ON ap.student_id = s.id
     WHERE s.archived_at IS NULL
       AND ($1::text IS NULL OR s.school_id = $1::text)
     GROUP BY s.id, s.name, s.created_at, s.last_active_at
     ORDER BY s.last_active_at DESC, s.name ASC;`,
    [schoolId ?? null]
  )) as Array<{
    student_id: string;
    student_name: string;
    created_at: string;
    last_active_at: string;
    activities_completed: number;
    total_questions_attempted: number;
    questions_completed: number;
    first_attempt_correct_count: number;
    questions_retried_count: number;
    total_retries_count: number;
    active_session_info: {
      subject: string;
      categoryOrModule: string;
      currentIndex: number;
      total: number;
      label: string;
    } | null;
  }>;

  return rows.map((r) => {
    const completed = Number(r.activities_completed) || 0;
    const attempted = Number(r.total_questions_attempted) || 0;
    const questionsCompleted = Number(r.questions_completed) || 0;
    const completionPercentage = Math.min(100, Math.round((completed / totalActivities) * 100));
    const accuracy = attempted > 0 ? Math.round((questionsCompleted / attempted) * 100) : 0;
    const resumePosition = r.active_session_info ? r.active_session_info.label : null;

    return {
      studentId: r.student_id,
      studentName: r.student_name,
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      lastPractisedAt: r.last_active_at,
      activitiesCompleted: completed,
      totalQuestionsAttempted: attempted,
      questionsCompleted,
      firstAttemptCorrectCount: Number(r.first_attempt_correct_count) || 0,
      questionsRetriedCount: Number(r.questions_retried_count) || 0,
      totalRetriesCount: Number(r.total_retries_count) || 0,
      completionPercentage,
      accuracy,
      resumePosition,
    };
  });
}

export async function getAdminStudentDetail(studentId: string): Promise<StudentDetailedProgress | null> {
  const sql = getDb();
  const student = await getStudentById(studentId);
  if (!student) return null;

  const summaries = await getAdminStudentSummaries(student.school_id);
  const summary = summaries.find((s) => s.studentId === studentId) || {
    studentId: student.id,
    studentName: student.name,
    createdAt: student.created_at,
    lastActiveAt: student.last_active_at,
    lastPractisedAt: student.last_active_at,
    activitiesCompleted: 0,
    totalQuestionsAttempted: 0,
    questionsCompleted: 0,
    firstAttemptCorrectCount: 0,
    questionsRetriedCount: 0,
    totalRetriesCount: 0,
    completionPercentage: 0,
    accuracy: 0,
    resumePosition: null,
  };

  const progressRows = (await sql.query(
    `SELECT
       activity_id,
       category,
       completed,
       correct,
       attempts,
       retry_count,
       first_attempt_correct,
       last_completed_at,
       last_attempted_at
     FROM activity_progress
     WHERE student_id = $1;`,
    [studentId]
  )) as Array<{
    activity_id: string;
    category: string;
    completed: boolean;
    correct: boolean;
    attempts: number;
    retry_count: number;
    first_attempt_correct: boolean | null;
    last_completed_at: string | null;
    last_attempted_at: string;
  }>;

  // Active session for current resume position
  const activeSessionRows = (await sql.query(
    `SELECT subject, category_or_module, current_index, activity_ids
     FROM learning_sessions
     WHERE student_id = $1 AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1;`,
    [studentId]
  )) as Array<{
    subject: string;
    category_or_module: string;
    current_index: number;
    activity_ids: string[] | string;
  }>;

  let resumePosition: string | null = null;
  if (activeSessionRows[0]) {
    const sRow = activeSessionRows[0];
    const actIds = typeof sRow.activity_ids === 'string' ? JSON.parse(sRow.activity_ids) : sRow.activity_ids;
    resumePosition = `Question ${sRow.current_index + 1} of ${actIds.length} (${sRow.category_or_module})`;
  }

  const allMetadata = allActivityMetadata();

  const categories: ActivityCategory[] = [
    'picture-recognition',
    'word-completion',
    'arrange-word',
    'spelling-choice',
    'context-choice',
    'meaning-match',
  ];

  const categoryMastery: StudentCategoryMastery[] = categories.map((cat) => {
    const catRows = progressRows.filter((p) => p.category === cat);
    const completed = catRows.filter((p) => p.completed).length;
    const attempted = catRows.filter((p) => p.attempts > 0 || p.completed).length;
    const firstAttemptCorrect = catRows.filter((p) => p.completed && p.first_attempt_correct === true).length;
    const retried = catRows.filter((p) => p.retry_count > 0).length;
    const totalRetries = catRows.reduce((acc, p) => acc + (p.retry_count || 0), 0);
    const totalAvailable = Math.max(catRows.length, 1);
    const notDone = Math.max(0, totalAvailable - completed);
    const accuracy = attempted > 0 ? Math.round((completed / attempted) * 100) : 0;
    return {
      category: cat,
      categoryTitle: CATEGORY_DISPLAY_NAMES[cat] || cat,
      totalAvailable,
      completed,
      notDone,
      accuracy,
      firstAttemptCorrect,
      retried,
      totalRetries,
      completionPercentage: Math.round((completed / totalAvailable) * 100),
    };
  });

  // Module Progress: activities done / not done per module
  const modulesMap = new Map<string, { subject: 'tamil' | 'english'; moduleId: number; total: number }>();
  for (const [, meta] of allMetadata) {
    const key = `${meta.subject}-${meta.moduleId}`;
    if (!modulesMap.has(key)) {
      modulesMap.set(key, { subject: meta.subject, moduleId: meta.moduleId, total: 0 });
    }
    modulesMap.get(key)!.total++;
  }

  const completedActivityIds = new Set(progressRows.filter((p) => p.completed).map((p) => p.activity_id));
  const attemptedActivityIds = new Set(progressRows.filter((p) => p.attempts > 0 || p.completed).map((p) => p.activity_id));

  const moduleProgress: StudentModuleProgress[] = Array.from(modulesMap.values())
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.moduleId - b.moduleId)
    .map((mod) => {
      // Find all activities for this module
      const modActivities = allMetadata.filter(([, m]) => m.subject === mod.subject && m.moduleId === mod.moduleId);
      const doneCount = modActivities.filter(([id]) => completedActivityIds.has(id)).length;
      const attemptedCount = modActivities.filter(([id]) => attemptedActivityIds.has(id)).length;
      const notDoneCount = Math.max(0, mod.total - doneCount);
      const accuracy = attemptedCount > 0 ? Math.round((doneCount / attemptedCount) * 100) : 0;
      return {
        moduleId: mod.moduleId,
        moduleTitle: `${mod.subject === 'tamil' ? 'à®¤à®®à®¿à®´à¯' : 'English'} Module ${mod.moduleId}`,
        subject: mod.subject,
        totalAvailable: mod.total,
        completed: doneCount,
        notDone: notDoneCount,
        accuracy,
        completionPercentage: Math.round((doneCount / mod.total) * 100),
      };
    });

  const questions: QuestionAttemptDetail[] = progressRows.map((p) => {
    const meta = lookupActivityMetadata(p.activity_id);
    const category = (p.category || 'spelling-choice') as ActivityCategory;
    const status: 'completed' | 'in-progress' | 'not-started' = p.completed
      ? 'completed'
      : p.attempts > 0
      ? 'in-progress'
      : 'not-started';

    return {
      questionId: p.activity_id,
      activityTitle: `Activity ${p.activity_id}`,
      category,
      categoryTitle: CATEGORY_DISPLAY_NAMES[category] || String(category),
      subject: meta?.subject || (p.activity_id.startsWith('E') || p.activity_id.startsWith('class3-english') ? 'English' : 'Tamil'),
      attempts: p.attempts || 0,
      retries: p.retry_count || 0,
      firstAttemptCorrect: p.first_attempt_correct ?? false,
      status,
      lastAttemptAt: p.last_attempted_at,
      completedAt: p.last_completed_at || undefined,
    };
  });

  questions.sort((a, b) => {
    const tA = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
    const tB = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
    return tB - tA;
  });

  return {
    studentId: student.id,
    studentName: student.name,
    createdAt: student.created_at,
    lastActiveAt: student.last_active_at,
    lastPractisedAt: student.last_active_at,
    accuracy: summary.accuracy,
    resumePosition,
    summary,
    categoryMastery,
    moduleProgress,
    questions,
  };
}

// â”€â”€ Phase 2: Assessment Tracking & Multi-School DB Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AssessmentSessionRow {
  id: string;
  student_id: string;
  school_id: string;
  class_id: string;
  subject_id: 'tamil' | 'english';
  module_id: number | null;
  session_status: 'in_progress' | 'completed' | 'abandoned';
  current_activity_id: string | null;
  current_question_id: string | null;
  current_question_index: number;
  activity_ids: string[];
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionAttemptRow {
  id: string;
  session_id: string | null;
  student_id: string;
  school_id: string;
  subject_id: string;
  module_id: number | null;
  activity_id: string;
  question_id: string;
  attempt_number: number;
  answer_payload: Record<string, unknown>;
  is_correct: boolean;
  is_completed: boolean;
  attempted_at: string;
  idempotency_key: string;
}

export interface StudentModuleProgressRow {
  student_id: string;
  school_id: string;
  subject_id: string;
  module_id: number;
  questions_attempted: number;
  total_attempts: number;
  retried_questions: number;
  total_retry_attempts: number;
  first_attempt_correct: number;
  finally_correct: number;
  questions_completed: number;
  last_attempted_at: string;
  last_completed_at: string | null;
}

export interface SchoolWithStatsRow {
  id: string;
  school_name: string;
  school_code: string;
  address: string | null;
  academic_year: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_students: number;
  total_classes: number;
}

export async function getSchoolsWithStatsFromDb(): Promise<SchoolWithStatsRow[]> {
  const sql = getDb();
  const rows = (await sql.query(`
    SELECT
      s.id,
      COALESCE(s.school_name, s.name) AS school_name,
      COALESCE(s.school_code, s.id) AS school_code,
      s.address,
      COALESCE(s.academic_year, '2026-2027') AS academic_year,
      COALESCE(s.is_active, s.archived_at IS NULL) AS is_active,
      s.created_at,
      COALESCE(s.updated_at, s.created_at) AS updated_at,
      COUNT(DISTINCT st.id) FILTER (WHERE st.archived_at IS NULL)::int AS total_students,
      COUNT(DISTINCT c.id) FILTER (WHERE c.archived_at IS NULL AND c.id != 'class_legacy')::int AS total_classes
    FROM schools s
    LEFT JOIN students st ON st.school_id = s.id
    LEFT JOIN classes c ON c.school_id = s.id
    WHERE s.archived_at IS NULL
    GROUP BY s.id, s.school_name, s.name, s.school_code, s.address, s.academic_year, s.is_active, s.created_at, s.updated_at
    ORDER BY s.name ASC;
  `)) as SchoolWithStatsRow[];
  return rows;
}

export async function createSchoolInDb(params: {
  id?: string;
  schoolName: string;
  schoolCode?: string;
  address?: string;
  academicYear?: string;
}): Promise<SchoolWithStatsRow> {
  const sql = getDb();
  const id = params.id || `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const code = (params.schoolCode || id).toUpperCase().trim();
  const academicYear = params.academicYear || '2026-2027';

  const rows = (await sql.query(
    `INSERT INTO schools (id, name, school_name, school_code, address, academic_year, is_active, created_at, updated_at)
     VALUES ($1, $2, $2, $3, $4, $5, TRUE, NOW(), NOW())
     RETURNING id, school_name, school_code, address, academic_year, is_active, created_at, updated_at;`,
    [id, params.schoolName, code, params.address ?? null, academicYear]
  )) as Array<{
    id: string;
    school_name: string;
    school_code: string;
    address: string | null;
    academic_year: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;

  return {
    ...rows[0],
    total_students: 0,
    total_classes: 0,
  };
}

export async function updateSchoolInDb(
  id: string,
  params: {
    schoolName?: string;
    address?: string;
    academicYear?: string;
    isActive?: boolean;
  }
): Promise<SchoolWithStatsRow | null> {
  const sql = getDb();
  const updates: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [id];

  if (params.schoolName !== undefined) {
    values.push(params.schoolName);
    updates.push(`name = $${values.length}`, `school_name = $${values.length}`);
  }
  if (params.address !== undefined) {
    values.push(params.address);
    updates.push(`address = $${values.length}`);
  }
  if (params.academicYear !== undefined) {
    values.push(params.academicYear);
    updates.push(`academic_year = $${values.length}`);
  }
  if (params.isActive !== undefined) {
    values.push(params.isActive);
    updates.push(`is_active = $${values.length}`);
    if (!params.isActive) {
      updates.push(`archived_at = NOW()`);
    } else {
      updates.push(`archived_at = NULL`);
    }
  }

  const query = `
    UPDATE schools
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING id, COALESCE(school_name, name) as school_name, COALESCE(school_code, id) as school_code, address, COALESCE(academic_year, '2026-2027') as academic_year, is_active, created_at, updated_at;
  `;
  const rows = (await sql.query(query, values)) as Array<{
    id: string;
    school_name: string;
    school_code: string;
    address: string | null;
    academic_year: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;

  if (!rows[0]) return null;

  const stats = (await sql.query(
    `SELECT
       COUNT(DISTINCT st.id) FILTER (WHERE st.archived_at IS NULL)::int AS total_students,
       COUNT(DISTINCT c.id) FILTER (WHERE c.archived_at IS NULL)::int AS total_classes
     FROM schools s
     LEFT JOIN students st ON st.school_id = s.id
     LEFT JOIN classes c ON c.school_id = s.id
     WHERE s.id = $1
     GROUP BY s.id;`,
    [id]
  )) as Array<{ total_students: number; total_classes: number }>;

  return {
    ...rows[0],
    total_students: stats[0]?.total_students ?? 0,
    total_classes: stats[0]?.total_classes ?? 0,
  };
}

export async function getStudentsWithFiltersFromDb(params: {
  schoolId?: string;
  classId?: string;
  section?: string;
  search?: string;
  limit?: number;
  offset?: number;
  status?: 'active' | 'archived' | 'all';
}): Promise<{ students: Array<StudentRow & { school_name: string; class_name: string; section: string; roll_number: string; is_active?: boolean }>; total: number }> {
  const sql = getDb();
  const conditions: string[] = [];
  if (params.status === 'archived') {
    conditions.push('s.archived_at IS NOT NULL');
  } else if (params.status === 'all') {
    // include both
  } else {
    conditions.push('s.archived_at IS NULL');
  }
  const values: unknown[] = [];

  if (params.schoolId) {
    values.push(params.schoolId);
    conditions.push(`s.school_id = $${values.length}`);
  }
  if (params.classId) {
    values.push(params.classId);
    conditions.push(`s.class_id = $${values.length}`);
  }
  if (params.section) {
    values.push(params.section);
    conditions.push(`COALESCE(s.section, 'A') = $${values.length}`);
  }
  if (params.search && params.search.trim()) {
    values.push(`%${params.search.trim().toLowerCase()}%`);
    conditions.push(`(LOWER(s.name) LIKE $${values.length} OR LOWER(COALESCE(s.roll_no, '')) LIKE $${values.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*)::int AS total FROM students s ${whereClause};`;
  const countResult = (await sql.query(countQuery, values)) as Array<{ total: number }>;
  const total = countResult[0]?.total ?? 0;

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
  const offset = Math.max(params.offset ?? 0, 0);

  values.push(limit);
  const limitIdx = values.length;
  values.push(offset);
  const offsetIdx = values.length;

  const dataQuery = `
    SELECT
      s.*,
      COALESCE(s.is_active, s.archived_at IS NULL) AS is_active,
      COALESCE(s.section, 'A') AS section,
      COALESCE(s.roll_number, s.roll_no) AS roll_number,
      COALESCE(sch.school_name, sch.name) AS school_name,
      COALESCE(c.name, 'Unassigned') AS class_name
    FROM students s
    LEFT JOIN schools sch ON sch.id = s.school_id
    LEFT JOIN classes c ON c.id = s.class_id
    ${whereClause}
    ORDER BY s.last_active_at DESC, s.name ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const students = (await sql.query(dataQuery, values)) as Array<
    StudentRow & { school_name: string; class_name: string; section: string; roll_number: string }
  >;

  return { students, total };
}

export async function updateStudentInDb(
  id: string,
  updates: {
    name?: string;
    rollNumber?: string;
    classId?: string;
    section?: string;
    isActive?: boolean;
    schoolId?: string;
  }
): Promise<StudentRow | null> {
  const sql = getDb();
  const existing = await getStudentById(id);
  if (!existing) return null;

  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [id];

  if (updates.name !== undefined && updates.name.trim()) {
    values.push(updates.name.trim());
    setClauses.push(`name = $${values.length}`);
    setClauses.push(`student_name = $${values.length}`);
  }
  if (updates.rollNumber !== undefined) {
    values.push(updates.rollNumber.trim());
    setClauses.push(`roll_no = $${values.length}`);
    setClauses.push(`roll_number = $${values.length}`);
  }
  if (updates.classId !== undefined) {
    const targetClass = await getClassById(updates.classId);
    if (targetClass) {
      values.push(targetClass.id);
      setClauses.push(`class_id = $${values.length}`);
      values.push(targetClass.school_id);
      setClauses.push(`school_id = $${values.length}`);
    }
  } else if (updates.schoolId !== undefined) {
    values.push(updates.schoolId);
    setClauses.push(`school_id = $${values.length}`);
  }
  if (updates.section !== undefined && updates.section.trim()) {
    values.push(updates.section.trim().toUpperCase());
    setClauses.push(`section = $${values.length}`);
  }
  if (updates.isActive !== undefined) {
    values.push(updates.isActive);
    setClauses.push(`is_active = $${values.length}`);
    if (updates.isActive) {
      setClauses.push(`archived_at = NULL`);
    } else {
      setClauses.push(`archived_at = NOW()`);
    }
  }

  const query = `
    UPDATE students
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;
  const rows = (await sql.query(query, values)) as StudentRow[];
  return rows[0] || null;
}

export async function updateClassInDb(
  id: string,
  updates: {
    name?: string;
    grade?: string;
    schoolId?: string;
  }
): Promise<ClassRow | null> {
  const sql = getDb();
  const existing = await getClassById(id);
  if (!existing) return null;

  const setClauses: string[] = [];
  const values: unknown[] = [id];

  if (updates.name !== undefined && updates.name.trim()) {
    values.push(updates.name.trim());
    setClauses.push(`name = $${values.length}`);
  }
  if (updates.grade !== undefined && updates.grade.trim()) {
    values.push(updates.grade.trim());
    setClauses.push(`grade = $${values.length}`);
  }
  if (updates.schoolId !== undefined && updates.schoolId.trim()) {
    values.push(updates.schoolId.trim());
    setClauses.push(`school_id = $${values.length}`);
  }

  if (setClauses.length === 0) return existing;

  const query = `
    UPDATE classes
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;
  const rows = (await sql.query(query, values)) as ClassRow[];
  return rows[0] || null;
}

export async function bulkImportStudentsInDb(params: {
  classId?: string;
  schoolId?: string;
  students: Array<{
    name: string;
    section?: string;
    rollNumber?: string;
    rollNo?: string;
    avatar?: string;
    classId?: string;
    schoolId?: string;
    schoolCode?: string;
    pin?: string[];
  }>;
}): Promise<Array<{ id: string; name: string; rollNumber: string; section: string; classId?: string; schoolId: string }>> {
  const sql = getDb();
  let defaultClass: ClassRow | null = null;
  if (params.classId) {
    defaultClass = await getClassById(params.classId);
  }

  const created: Array<{ id: string; name: string; rollNumber: string; section: string; classId?: string; schoolId: string }> = [];

  for (const s of params.students) {
    let schoolId = s.schoolId || params.schoolId || defaultClass?.school_id;
    if (!schoolId && s.schoolCode) {
      const schRows = (await sql.query(
        `SELECT id FROM schools WHERE school_code = $1 OR id = $1 LIMIT 1;`,
        [s.schoolCode.trim().toUpperCase()]
      )) as Array<{ id: string }>;
      if (schRows[0]) schoolId = schRows[0].id;
    }

    if (!schoolId) {
      const activeSchools = await getActiveSchoolsFromDb();
      if (activeSchools.length === 1) {
        schoolId = activeSchools[0].id;
      } else {
        throw new Error(`School not found or specified for student: ${s.name}`);
      }
    }

    const rawRoll = s.rollNumber || s.rollNo;
    const rollNo = rawRoll && rawRoll.trim() ? rawRoll.trim() : `R${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const section = s.section && s.section.trim() ? s.section.trim().toUpperCase() : 'A';
    const avatar = s.avatar || 'avatar_default';
    const targetClassId = s.classId || params.classId || defaultClass?.id || null;

    // Check duplicate roll number in this school
    const existing = (await sql.query(
      `SELECT id FROM students
       WHERE school_id = $1
         AND (roll_no = $2 OR roll_number = $2)
         AND archived_at IS NULL
       LIMIT 1;`,
      [schoolId, rollNo]
    )) as Array<{ id: string }>;

    if (existing.length > 0) {
      throw new Error(`duplicate roll numbers detected: "${rollNo}" already exists in school ${schoolId}`);
    }

    const id = `stud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await sql.query(
      `INSERT INTO students (id, name, student_name, school_id, class_id, roll_no, roll_number, section, avatar, is_active, created_at, last_active_at)
       VALUES ($1, $2, $2, $3, $4, $5, $5, $6, $7, TRUE, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         student_name = EXCLUDED.student_name,
         roll_no = EXCLUDED.roll_no,
         roll_number = EXCLUDED.roll_number,
         section = EXCLUDED.section;`,
      [id, s.name.trim(), schoolId, targetClassId, rollNo, section, avatar]
    );

    created.push({ id, name: s.name.trim(), rollNumber: rollNo, section, classId: targetClassId || '', schoolId });
  }

  return created;
}

// â”€â”€ Assessment Sessions Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatAssessmentSessionRow(r: AssessmentSessionRow): AssessmentSessionRow {
  const row = { ...r };
  if (typeof row.activity_ids === 'string') {
    try {
      row.activity_ids = JSON.parse(row.activity_ids);
    } catch {
      row.activity_ids = [];
    }
  }
  return row;
}

export async function createOrGetAssessmentSessionInDb(params: {
  id?: string;
  studentId: string;
  subjectId: 'tamil' | 'english';
  moduleId?: number | null;
  activityIds: string[];
  currentActivityId?: string;
  currentQuestionId?: string;
  currentIndex?: number;
}): Promise<AssessmentSessionRow> {
  const sql = getDb();
  const student = await getStudentById(params.studentId);
  if (!student) {
    throw new Error('Student not found or archived');
  }

  const schoolId = student.school_id;
  const classId = student.class_id;

  if (params.id) {
    const existing = await getAssessmentSessionByIdFromDb(params.id);
    if (existing) {
      return existing;
    }
  }

  const id = params.id || `asess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const activityIdsJson = JSON.stringify(params.activityIds);
  const currentIndex = params.currentIndex ?? 0;
  const currentActivityId = params.currentActivityId || params.activityIds[currentIndex] || null;

  // Insert session
  const rows = (await sql.query(
    `INSERT INTO assessment_sessions (
       id, student_id, school_id, class_id, subject_id, module_id,
       session_status, current_activity_id, current_question_id, current_question_index,
       activity_ids, started_at, last_activity_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       'in_progress', $7, $8, $9,
       $10::jsonb, NOW(), NOW(), NOW(), NOW()
     )
     RETURNING *;`,
    [
      id,
      student.id,
      schoolId,
      classId,
      params.subjectId,
      params.moduleId ?? null,
      currentActivityId,
      params.currentQuestionId ?? null,
      currentIndex,
      activityIdsJson,
    ]
  )) as AssessmentSessionRow[];

  return formatAssessmentSessionRow(rows[0]);
}

export async function getAssessmentSessionByIdFromDb(sessionId: string): Promise<AssessmentSessionRow | null> {
  const sql = getDb();
  const rows = (await sql.query(
    'SELECT * FROM assessment_sessions WHERE id = $1 LIMIT 1;',
    [sessionId]
  )) as AssessmentSessionRow[];

  if (!rows[0]) return null;
  return formatAssessmentSessionRow(rows[0]);
}

export async function getActiveAssessmentSessionForStudentFromDb(
  studentId: string,
  subjectId?: string,
  moduleId?: number | null
): Promise<AssessmentSessionRow | null> {
  const sql = getDb();
  let query = "SELECT * FROM assessment_sessions WHERE student_id = $1 AND session_status = 'in_progress'";
  const values: unknown[] = [studentId];

  if (subjectId) {
    values.push(subjectId.toLowerCase());
    query += ` AND subject_id = $${values.length}`;
  }
  if (moduleId !== undefined && moduleId !== null) {
    values.push(moduleId);
    query += ` AND module_id = $${values.length}`;
  }

  query += ' ORDER BY last_activity_at DESC LIMIT 1;';
  const rows = (await sql.query(query, values)) as AssessmentSessionRow[];
  if (!rows[0]) return null;
  return formatAssessmentSessionRow(rows[0]);
}

export async function updateAssessmentSessionInDb(params: {
  sessionId: string;
  studentId: string;
  currentActivityId?: string;
  currentQuestionId?: string;
  currentIndex?: number;
  sessionStatus?: 'in_progress' | 'completed' | 'abandoned';
}): Promise<AssessmentSessionRow | null> {
  const sql = getDb();
  const updates: string[] = ['last_activity_at = NOW()', 'updated_at = NOW()'];
  const values: unknown[] = [params.sessionId, params.studentId];

  if (params.currentActivityId !== undefined) {
    values.push(params.currentActivityId);
    updates.push(`current_activity_id = $${values.length}`);
  }
  if (params.currentQuestionId !== undefined) {
    values.push(params.currentQuestionId);
    updates.push(`current_question_id = $${values.length}`);
  }
  if (params.currentIndex !== undefined) {
    values.push(params.currentIndex);
    updates.push(`current_question_index = GREATEST(assessment_sessions.current_question_index, $${values.length})`);
  }
  if (params.sessionStatus !== undefined) {
    values.push(params.sessionStatus);
    updates.push(`session_status = $${values.length}`);
    if (params.sessionStatus === 'completed') {
      updates.push('completed_at = COALESCE(completed_at, NOW())');
    }
  }

  const query = `
    UPDATE assessment_sessions
    SET ${updates.join(', ')}
    WHERE id = $1 AND student_id = $2
    RETURNING *;
  `;
  const rows = (await sql.query(query, values)) as AssessmentSessionRow[];
  if (!rows[0]) return null;
  return formatAssessmentSessionRow(rows[0]);
}

// â”€â”€ Question Attempts Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function recordQuestionAttemptInDb(params: {
  id?: string;
  sessionId?: string;
  studentId: string;
  subjectId: 'tamil' | 'english';
  moduleId?: number | null;
  activityId: string;
  questionId: string;
  answerPayload?: Record<string, unknown>;
  isCorrect: boolean;
  isCompleted: boolean;
  attemptedAt?: string;
  idempotencyKey: string;
}): Promise<{ status: 'recorded' | 'duplicate'; attempt: QuestionAttemptRow }> {
  const sql = getDb();

  // 1. Idempotency Check
  const existing = (await sql.query(
    'SELECT * FROM question_attempts WHERE idempotency_key = $1 LIMIT 1;',
    [params.idempotencyKey]
  )) as QuestionAttemptRow[];

  if (existing[0]) {
    return { status: 'duplicate', attempt: existing[0] };
  }

  // 2. Student Verification
  const student = await getStudentById(params.studentId);
  if (!student) {
    throw new Error('Student not found or archived');
  }
  const schoolId = student.school_id;

  // 3. Session lookup / validation
  let sessionId = params.sessionId ?? null;
  if (sessionId) {
    const sess = await getAssessmentSessionByIdFromDb(sessionId);
    if (!sess || sess.student_id !== student.id) {
      sessionId = null;
    }
  }

  // 4. Calculate monotonic attempt_number for (session_id, question_id)
  let attemptNumber = 1;
  if (sessionId) {
    const numRows = (await sql.query(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_num
       FROM question_attempts
       WHERE session_id = $1 AND question_id = $2;`,
      [sessionId, params.questionId]
    )) as Array<{ next_num: number }>;
    attemptNumber = Number(numRows[0]?.next_num) || 1;
  } else {
    const numRows = (await sql.query(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_num
       FROM question_attempts
       WHERE student_id = $1 AND question_id = $2;`,
      [student.id, params.questionId]
    )) as Array<{ next_num: number }>;
    attemptNumber = Number(numRows[0]?.next_num) || 1;
  }

  const id = params.id || `qatt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const attemptedAt = params.attemptedAt || new Date().toISOString();
  const answerPayloadJson = JSON.stringify(params.answerPayload ?? {});

  // 5. Insert question_attempts row
  const rows = (await sql.query(
    `INSERT INTO question_attempts (
       id, session_id, student_id, school_id, subject_id, module_id,
       activity_id, question_id, attempt_number, answer_payload,
       is_correct, is_completed, attempted_at, idempotency_key
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10::jsonb,
       $11, $12, $13::timestamptz, $14
     )
     ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
     RETURNING *;`,
    [
      id,
      sessionId,
      student.id,
      schoolId,
      params.subjectId,
      params.moduleId ?? null,
      params.activityId,
      params.questionId,
      attemptNumber,
      answerPayloadJson,
      params.isCorrect,
      params.isCompleted,
      attemptedAt,
      params.idempotencyKey,
    ]
  )) as QuestionAttemptRow[];

  // 6. Update assessment_sessions position if sessionId is provided
  if (sessionId) {
    await sql.query(
      `UPDATE assessment_sessions
       SET current_activity_id = $1,
           current_question_id = $2,
           last_activity_at = NOW(),
           updated_at = NOW()
       WHERE id = $3;`,
      [params.activityId, params.questionId, sessionId]
    );
  }

  // 7. Synchronize legacy attempt and progress for existing tests & backward compatibility
  try {
    await recordAttemptInDb({
      id: `legacy_${id}`,
      studentId: student.id,
      activityId: params.activityId,
      category: undefined,
      attemptNumber,
      result: params.isCorrect ? 'correct' : 'incorrect',
      completed: params.isCompleted,
      timestamp: attemptedAt,
    });
  } catch {
    // Non-fatal legacy sync
  }

  return { status: 'recorded', attempt: rows[0] };
}

export async function getQuestionAttemptsForSessionFromDb(sessionId: string): Promise<QuestionAttemptRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM question_attempts WHERE session_id = $1 ORDER BY attempted_at ASC, attempt_number ASC;',
    [sessionId]
  )) as QuestionAttemptRow[];
}

export async function getQuestionAttemptsForStudentFromDb(studentId: string): Promise<QuestionAttemptRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM question_attempts WHERE student_id = $1 ORDER BY attempted_at DESC;',
    [studentId]
  )) as QuestionAttemptRow[];
}

// â”€â”€ Admin Institutional Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getOverallAdminMetrics(): Promise<{
  totalSchools: number;
  totalStudents: number;
  studentsAssessed: number;
  assessmentSessions: number;
  modulesAttempted: number;
  totalQuestionsAttempted: number;
  totalRetries: number;
  completedAssessments: number;
}> {
  const sql = getDb();
  const rows = (await sql.query(`
    SELECT
      (SELECT COUNT(*)::int FROM schools WHERE archived_at IS NULL) AS total_schools,
      (SELECT COUNT(*)::int FROM students WHERE archived_at IS NULL) AS total_students,
      (SELECT COUNT(DISTINCT student_id)::int FROM question_attempts) AS students_assessed,
      (SELECT COUNT(*)::int FROM assessment_sessions) AS assessment_sessions,
      (SELECT COUNT(*)::int FROM assessment_sessions WHERE session_status = 'completed') AS completed_assessments,
      (SELECT COUNT(DISTINCT (subject_id || '-' || COALESCE(module_id::text, '0')))::int FROM question_attempts) AS modules_attempted,
      (SELECT COUNT(DISTINCT question_id)::int FROM question_attempts) AS total_questions_attempted,
      COALESCE((SELECT SUM(total_retry_attempts)::int FROM student_module_progress), 0) AS total_retries;
  `)) as Array<{
    total_schools: number;
    total_students: number;
    students_assessed: number;
    assessment_sessions: number;
    completed_assessments: number;
    modules_attempted: number;
    total_questions_attempted: number;
    total_retries: number;
  }>;

  const r = rows[0] || {
    total_schools: 0,
    total_students: 0,
    students_assessed: 0,
    assessment_sessions: 0,
    completed_assessments: 0,
    modules_attempted: 0,
    total_questions_attempted: 0,
    total_retries: 0,
  };

  return {
    totalSchools: Number(r.total_schools) || 0,
    totalStudents: Number(r.total_students) || 0,
    studentsAssessed: Number(r.students_assessed) || 0,
    assessmentSessions: Number(r.assessment_sessions) || 0,
    modulesAttempted: Number(r.modules_attempted) || 0,
    totalQuestionsAttempted: Number(r.total_questions_attempted) || 0,
    totalRetries: Number(r.total_retries) || 0,
    completedAssessments: Number(r.completed_assessments) || 0,
  };
}

export async function getSchoolReportFromDb(schoolId: string): Promise<{
  school: SchoolRow & { school_name: string; school_code: string; academic_year: string };
  totalStudents: number;
  studentsAssessed: number;
  classes: Array<{ classId: string; className: string; grade: string; registeredStudents: number; assessedStudents: number }>;
  modules: Array<{ subject: string; moduleId: number; questionsAttempted: number; totalAttempts: number; retriedQuestions: number; completedCount: number }>;
  totalAttempts: number;
  retriedQuestions: number;
  completedAssessments: number;
  tamilProgress: { questionsAttempted: number; completedCount: number };
  englishProgress: { questionsAttempted: number; completedCount: number };
} | null> {
  const sql = getDb();
  const schoolRows = (await sql.query(
    `SELECT *, COALESCE(school_name, name) as school_name, COALESCE(school_code, id) as school_code, COALESCE(academic_year, '2026-2027') as academic_year
     FROM schools WHERE id = $1 AND archived_at IS NULL LIMIT 1;`,
    [schoolId]
  )) as Array<SchoolRow & { school_name: string; school_code: string; academic_year: string }>;

  if (!schoolRows[0]) return null;
  const school = schoolRows[0];

  const totalStudents = Number(
    ((await sql.query('SELECT COUNT(*)::int as count FROM students WHERE school_id = $1 AND archived_at IS NULL;', [schoolId])) as [{ count: number }])[0]?.count || 0
  );

  const studentsAssessed = Number(
    ((await sql.query('SELECT COUNT(DISTINCT student_id)::int as count FROM question_attempts WHERE school_id = $1;', [schoolId])) as [{ count: number }])[0]?.count || 0
  );

  const completedAssessments = Number(
    ((await sql.query("SELECT COUNT(*)::int as count FROM assessment_sessions WHERE school_id = $1 AND session_status = 'completed';", [schoolId])) as [{ count: number }])[0]?.count || 0
  );

  const classRows = (await sql.query(
    `SELECT
       c.id AS class_id,
       c.name AS class_name,
       c.grade,
       COUNT(DISTINCT s.id) FILTER (WHERE s.archived_at IS NULL)::int AS registered_students,
       COUNT(DISTINCT qa.student_id)::int AS assessed_students
     FROM classes c
     LEFT JOIN students s ON s.class_id = c.id
     LEFT JOIN question_attempts qa ON qa.student_id = s.id
     WHERE c.school_id = $1 AND c.archived_at IS NULL AND c.id != 'class_legacy'
     GROUP BY c.id, c.name, c.grade
     ORDER BY c.grade ASC, c.name ASC;`,
    [schoolId]
  )) as Array<{ class_id: string; class_name: string; grade: string; registered_students: number; assessed_students: number }>;

  const moduleRows = (await sql.query(
    `SELECT
       smp.subject_id AS subject,
       smp.module_id,
       SUM(smp.questions_attempted)::int AS questions_attempted,
       SUM(smp.total_attempts)::int AS total_attempts,
       SUM(smp.retried_questions)::int AS retried_questions,
       SUM(smp.questions_completed)::int AS completed_count
     FROM student_module_progress smp
     WHERE smp.school_id = $1
     GROUP BY smp.subject_id, smp.module_id
     ORDER BY smp.subject_id ASC, smp.module_id ASC;`,
    [schoolId]
  )) as Array<{ subject: string; moduleId: number; questions_attempted: number; total_attempts: number; retried_questions: number; completed_count: number }>;

  const totals = (await sql.query(
    `SELECT
       COALESCE(SUM(total_attempts), 0)::int AS total_attempts,
       COALESCE(SUM(retried_questions), 0)::int AS retried_questions
     FROM student_module_progress
     WHERE school_id = $1;`,
    [schoolId]
  )) as Array<{ total_attempts: number; retried_questions: number }>;

  return {
    school,
    totalStudents,
    studentsAssessed,
    classes: classRows.map((c) => ({
      classId: c.class_id,
      className: c.class_name,
      grade: c.grade,
      registeredStudents: Number(c.registered_students) || 0,
      assessedStudents: Number(c.assessed_students) || 0,
    })),
    modules: moduleRows.map((m) => ({
      subject: m.subject,
      moduleId: m.moduleId,
      questionsAttempted: Number(m.questions_attempted) || 0,
      totalAttempts: Number(m.total_attempts) || 0,
      retriedQuestions: Number(m.retried_questions) || 0,
      completedCount: Number(m.completed_count) || 0,
    })),
    totalAttempts: Number(totals[0]?.total_attempts) || 0,
    retriedQuestions: Number(totals[0]?.retried_questions) || 0,
    completedAssessments,
    tamilProgress: {
      questionsAttempted: moduleRows.filter((m) => m.subject === 'tamil').reduce((acc, m) => acc + (Number(m.questions_attempted) || 0), 0),
      completedCount: moduleRows.filter((m) => m.subject === 'tamil').reduce((acc, m) => acc + (Number(m.completed_count) || 0), 0),
    },
    englishProgress: {
      questionsAttempted: moduleRows.filter((m) => m.subject === 'english').reduce((acc, m) => acc + (Number(m.questions_attempted) || 0), 0),
      completedCount: moduleRows.filter((m) => m.subject === 'english').reduce((acc, m) => acc + (Number(m.completed_count) || 0), 0),
    },
  };
}

export async function getStudentModuleProgressFromDb(studentId: string): Promise<StudentModuleProgressRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM student_module_progress WHERE student_id = $1 ORDER BY subject_id ASC, module_id ASC;',
    [studentId]
  )) as StudentModuleProgressRow[];
}

export async function getStudentSessionsReportFromDb(studentId: string): Promise<Array<{
  sessionId: string;
  subjectId: string;
  moduleId: number | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  lastActivityAt: string;
  totalQuestions: number;
  totalAttempts: number;
  retriedQuestions: number;
  durationMinutes: number | null;
}>> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT
       s.id AS session_id,
       s.subject_id,
       s.module_id,
       s.session_status AS status,
       s.started_at,
       s.completed_at,
       s.last_activity_at,
       COUNT(DISTINCT qa.question_id)::int AS total_questions,
       COUNT(qa.id)::int AS total_attempts,
       COUNT(DISTINCT qa.question_id) FILTER (WHERE (
         SELECT COUNT(*) FROM question_attempts qa2 WHERE qa2.session_id = s.id AND qa2.question_id = qa.question_id
       ) > 1)::int AS retried_questions,
       ROUND(EXTRACT(EPOCH FROM (COALESCE(s.completed_at, s.last_activity_at) - s.started_at)) / 60)::int AS duration_minutes
     FROM assessment_sessions s
     LEFT JOIN question_attempts qa ON qa.session_id = s.id
     WHERE s.student_id = $1
     GROUP BY s.id, s.subject_id, s.module_id, s.session_status, s.started_at, s.completed_at, s.last_activity_at
     ORDER BY s.started_at DESC;`,
    [studentId]
  )) as Array<{
    session_id: string;
    subject_id: string;
    module_id: number | null;
    status: string;
    started_at: string;
    completed_at: string | null;
    last_activity_at: string;
    total_questions: number;
    total_attempts: number;
    retried_questions: number;
    duration_minutes: number | null;
  }>;

  return rows.map((r) => ({
    sessionId: r.session_id,
    subjectId: r.subject_id,
    moduleId: r.module_id,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    lastActivityAt: r.last_activity_at,
    totalQuestions: Number(r.total_questions) || 0,
    totalAttempts: Number(r.total_attempts) || 0,
    retriedQuestions: Number(r.retried_questions) || 0,
    durationMinutes: r.duration_minutes !== null ? Number(r.duration_minutes) : null,
  }));
}

export async function getSessionDetailReportFromDb(sessionId: string): Promise<{
  session: AssessmentSessionRow;
  student: StudentRow;
  school: SchoolRow;
  questions: Array<{
    questionId: string;
    activityId: string;
    attempts: number;
    firstAttemptResult: 'correct' | 'incorrect';
    finalResult: 'correct' | 'incorrect';
    isCompleted: boolean;
    lastAttemptedAt: string;
  }>;
} | null> {
  const sql = getDb();
  const session = await getAssessmentSessionByIdFromDb(sessionId);
  if (!session) return null;

  const student = await getStudentById(session.student_id);
  if (!student) return null;

  const schoolRows = (await sql.query('SELECT * FROM schools WHERE id = $1 LIMIT 1;', [session.school_id])) as SchoolRow[];
  const school = schoolRows[0];

  const questionStats = (await sql.query(
    `SELECT
       question_id,
       activity_id,
       COUNT(*)::int AS attempts,
       (ARRAY_AGG(is_correct ORDER BY attempt_number ASC))[1] AS first_is_correct,
       (ARRAY_AGG(is_correct ORDER BY attempt_number DESC))[1] AS final_is_correct,
       BOOL_OR(is_completed) AS is_completed,
       MAX(attempted_at) AS last_attempted_at
     FROM question_attempts
     WHERE session_id = $1
     GROUP BY question_id, activity_id
     ORDER BY MIN(attempted_at) ASC;`,
    [sessionId]
  )) as Array<{
    question_id: string;
    activity_id: string;
    attempts: number;
    first_is_correct: boolean;
    final_is_correct: boolean;
    is_completed: boolean;
    last_attempted_at: string;
  }>;

  return {
    session,
    student,
    school,
    questions: questionStats.map((q) => ({
      questionId: q.question_id,
      activityId: q.activity_id,
      attempts: Number(q.attempts) || 0,
      firstAttemptResult: q.first_is_correct ? 'correct' : 'incorrect',
      finalResult: q.final_is_correct ? 'correct' : 'incorrect',
      isCompleted: q.is_completed,
      lastAttemptedAt: q.last_attempted_at,
    })),
  };
}
