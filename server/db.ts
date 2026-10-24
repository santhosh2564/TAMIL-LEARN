import dotenv from 'dotenv';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// Load local environment variables from .env.local if not already present in process.env
if (!process.env.DATABASE_URL && fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

let sqlInstance: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!sqlInstance) {
    const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Ensure .env.local or DATABASE_URL is available in server environment.');
    }
    sqlInstance = neon(connectionString);
  }
  return sqlInstance;
}

export async function runMigrations(): Promise<void> {
  const sql = getDb();
  const schemaPath = path.resolve(process.cwd(), 'server', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Clean comments before splitting
  const cleanedSql = schemaSql
    .split('\n')
    .map(line => line.trim().startsWith('--') ? '' : line)
    .join('\n');

  const statements = cleanedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await sql.query(statement);
  }
}

export interface StudentRow {
  id: string;
  name: string;
  created_at: string;
  last_active_at: string;
}

export interface ProgressRow {
  student_id: string;
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
  activity_id: string;
  category: string | null;
  attempt_number: number;
  result: string;
  completed: boolean;
  timestamp: string;
}

// Student operations
export async function getStudentsFromDb(): Promise<StudentRow[]> {
  const sql = getDb();
  return (await sql.query('SELECT * FROM students ORDER BY last_active_at DESC;')) as StudentRow[];
}

export async function upsertStudentInDb(student: { id: string; name: string; createdAt: string; lastActiveAt: string }): Promise<void> {
  const sql = getDb();
  await sql.query(
    `INSERT INTO students (id, name, created_at, last_active_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       last_active_at = EXCLUDED.last_active_at;`,
    [student.id, student.name, student.createdAt, student.lastActiveAt]
  );
}

export async function deleteStudentFromDb(id: string): Promise<void> {
  const sql = getDb();
  await sql.query('DELETE FROM students WHERE id = $1;', [id]);
}

// Progress operations
export async function getProgressForStudentFromDb(studentId: string): Promise<ProgressRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM activity_progress WHERE student_id = $1 ORDER BY last_attempted_at DESC;',
    [studentId]
  )) as ProgressRow[];
}

export async function upsertProgressInDb(progress: {
  studentId: string;
  activityId: string;
  category: string;
  completed: boolean;
  correct: boolean;
  attempts: number;
  correctAttempts?: number;
  incorrectAttempts?: number;
  retryCount?: number;
  firstAttemptCorrect?: boolean;
  finalCorrect?: boolean;
  lastCompletedAt?: string;
  lastAttemptedAt?: string;
}): Promise<void> {
  const sql = getDb();
  await sql.query(
    `INSERT INTO activity_progress (
       student_id, activity_id, category, completed, correct, attempts,
       correct_attempts, incorrect_attempts, retry_count,
       first_attempt_correct, final_correct, last_completed_at, last_attempted_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (student_id, activity_id) DO UPDATE SET
       category = EXCLUDED.category,
       completed = EXCLUDED.completed,
       correct = EXCLUDED.correct,
       attempts = EXCLUDED.attempts,
       correct_attempts = EXCLUDED.correct_attempts,
       incorrect_attempts = EXCLUDED.incorrect_attempts,
       retry_count = EXCLUDED.retry_count,
       first_attempt_correct = EXCLUDED.first_attempt_correct,
       final_correct = EXCLUDED.final_correct,
       last_completed_at = EXCLUDED.last_completed_at,
       last_attempted_at = EXCLUDED.last_attempted_at;`,
    [
      progress.studentId,
      progress.activityId,
      progress.category,
      progress.completed,
      progress.correct,
      progress.attempts,
      progress.correctAttempts ?? 0,
      progress.incorrectAttempts ?? 0,
      progress.retryCount ?? 0,
      progress.firstAttemptCorrect ?? null,
      progress.finalCorrect ?? null,
      progress.lastCompletedAt ?? null,
      progress.lastAttemptedAt ?? new Date().toISOString()
    ]
  );
}

// Attempt operations
export async function recordAttemptInDb(attempt: {
  id: string;
  studentId: string;
  activityId: string;
  category?: string;
  attemptNumber: number;
  result: string;
  completed: boolean;
  timestamp: string;
}): Promise<void> {
  const sql = getDb();
  await sql.query(
    `INSERT INTO attempts (id, student_id, activity_id, category, attempt_number, result, completed, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING;`,
    [
      attempt.id,
      attempt.studentId,
      attempt.activityId,
      attempt.category ?? null,
      attempt.attemptNumber,
      attempt.result,
      attempt.completed,
      attempt.timestamp
    ]
  );
}

export async function getAttemptsForStudentFromDb(studentId: string): Promise<AttemptRow[]> {
  const sql = getDb();
  return (await sql.query(
    'SELECT * FROM attempts WHERE student_id = $1 ORDER BY timestamp ASC;',
    [studentId]
  )) as AttemptRow[];
}
