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
  QuestionAttemptDetail,
} from '../src/admin/types';
import type { ActivityCategory } from '../src/types';

// ── Connection ────────────────────────────────────────────────────────────────
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

// ── SQL Statement Splitter (Preserves DO $$ ... $$ blocks) ────────────────────
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

// ── Migration Runner ──────────────────────────────────────────────────────────
export async function runMigrations(customDb?: NeonQueryFunction<false, false>): Promise<void> {
  const sql = customDb || getDb();
  // Schema first, then the manifest-generated attempt metadata backfill.
  const files = [
    path.resolve(process.cwd(), 'server', 'schema.sql'),
    path.resolve(process.cwd(), 'server', 'migrations', 'attempts_metadata_backfill.sql'),
  ];

  for (const file of files) {
    const statements = splitSqlStatements(fs.readFileSync(file, 'utf8'));
    for (const statement of statements) {
      await sql.query(statement);
    }
  }
}

// ── Type rows ─────────────────────────────────────────────────────────────────
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

// ── School & Class operations ─────────────────────────────────────────────────
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

// ── Student operations ────────────────────────────────────────────────────────
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
  classId?: string;
  rollNo?: string;
  avatar?: string;
  pinHash?: string | null;
  createdAt?: string;
  lastActiveAt?: string;
}): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql.query(
    `INSERT INTO students (id, name, school_id, class_id, roll_no, avatar, pin_hash, created_at, last_active_at)
     VALUES (
       $1,
       $2,
       COALESCE($3, 'school_unassigned'),
       COALESCE($4, 'class_legacy'),
       COALESCE($5, $1),
       COALESCE($6, 'avatar_default'),
       $7,
       COALESCE($8::timestamptz, $9::timestamptz),
       COALESCE($9::timestamptz, $8::timestamptz)
     )
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       school_id = COALESCE(EXCLUDED.school_id, students.school_id),
       class_id = COALESCE(EXCLUDED.class_id, students.class_id),
       roll_no = COALESCE(EXCLUDED.roll_no, students.roll_no),
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

// ── Progress operations ───────────────────────────────────────────────────────
export async function getProgressForStudentFromDb(
  studentId: string
): Promise<ProgressRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM activity_progress WHERE student_id = $1 ORDER BY last_attempted_at DESC;',
    [studentId]
  )) as ProgressRow[];
}

// ── Attempt operations (Single CTE with Idempotent Progress Upsert) ────────────
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

// ── Admin operations ──────────────────────────────────────────────────────────
export async function getAdminByUsername(
  username: string
): Promise<AdminRow | null> {
  const sql = getDb();
  const rows = (await sql.query(
    'SELECT * FROM admins WHERE username = $1 LIMIT 1;',
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

// ── Phase 4: Learning Session DB Operations ───────────────────────────────────
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

// ── Admin Dashboard & Progress Aggregations (School-Scoped SQL) ───────────────
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'picture-recognition': 'படம் பார்த்து சொல் (Picture Recognition)',
  'word-completion': 'சொல் நிரப்புக (Word Completion)',
  'arrange-word': 'சொல் உருவாக்குக (Arrange Word)',
  'spelling-choice': 'சரியான எழுத்துக்கூட்டல் (Spelling Choice)',
  'context-choice': 'வாக்கியப் பயிற்சி (Context Choice)',
  'meaning-match': 'பொருள் அறிவோம் (Meaning Match)',
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
       COALESCE(SUM(ap.retry_count), 0)::int AS total_retries_count
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
  }>;

  return rows.map((r) => {
    const completed = Number(r.activities_completed) || 0;
    const completionPercentage = Math.min(100, Math.round((completed / totalActivities) * 100));
    return {
      studentId: r.student_id,
      studentName: r.student_name,
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      activitiesCompleted: completed,
      totalQuestionsAttempted: Number(r.total_questions_attempted) || 0,
      questionsCompleted: Number(r.questions_completed) || 0,
      firstAttemptCorrectCount: Number(r.first_attempt_correct_count) || 0,
      questionsRetriedCount: Number(r.questions_retried_count) || 0,
      totalRetriesCount: Number(r.total_retries_count) || 0,
      completionPercentage,
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
    activitiesCompleted: 0,
    totalQuestionsAttempted: 0,
    questionsCompleted: 0,
    firstAttemptCorrectCount: 0,
    questionsRetriedCount: 0,
    totalRetriesCount: 0,
    completionPercentage: 0,
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
    const firstAttemptCorrect = catRows.filter((p) => p.completed && p.first_attempt_correct === true).length;
    const retried = catRows.filter((p) => p.retry_count > 0).length;
    const totalRetries = catRows.reduce((acc, p) => acc + (p.retry_count || 0), 0);
    const totalAvailable = Math.max(catRows.length, 1);
    return {
      category: cat,
      categoryTitle: CATEGORY_DISPLAY_NAMES[cat] || cat,
      totalAvailable,
      completed,
      firstAttemptCorrect,
      retried,
      totalRetries,
      completionPercentage: Math.round((completed / totalAvailable) * 100),
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
    summary,
    categoryMastery,
    questions,
  };
}

