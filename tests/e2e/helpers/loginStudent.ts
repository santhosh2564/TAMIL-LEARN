/**
 * Shared Playwright helper (usable from specs and standalone scripts): seeds a school, class, students (known picture PIN) and an
 * optional school admin on the TEST database, and logs a student in the way a child does:
 * /c/:classCode -> tap name -> tap 3 pictures.
 *
 * Only ever talks to TEST_DATABASE_URL; refuses to run if it equals DATABASE_URL.
 */
import { Page } from '@playwright/test';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export const TEST_PIN = ['sun', 'star', 'tree'];
const UNAMBIGUOUS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set.');
  if (process.env.DATABASE_URL && url.trim() === process.env.DATABASE_URL.trim()) {
    throw new Error('TEST_DATABASE_URL equals DATABASE_URL (production). Refusing.');
  }
  if (url.includes('ep-late-haze-b593dxrs')) {
    throw new Error('TEST_DATABASE_URL points at the production endpoint (ep-late-haze-b593dxrs). Refusing.');
  }
  return url;
}

export function testDb(): NeonQueryFunction<false, false> {
  return neon(testDatabaseUrl());
}

export interface SeededStudent {
  id: string;
  /** Single first name: the class roster shows first names only. */
  name: string;
}

export interface SeededClass {
  schoolId: string;
  classId: string;
  classCode: string;
  students: SeededStudent[];
  admin: { id: string; username: string; password: string } | null;
}

/**
 * Seeds one school + class with the given students (all with TEST_PIN), and optionally a
 * school_admin for that school. `tag` keeps ids readable in the TEST database.
 */
export async function seedClass(opts: { tag: string; students: string[]; withAdmin?: boolean; withPin?: boolean }): Promise<SeededClass> {
  const sql = testDb();
  const suffix = `${opts.tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const schoolId = `sch_e2e_${suffix}`;
  const classId = `cls_e2e_${suffix}`;
  const classCode = Array.from({ length: 6 }, () => UNAMBIGUOUS[Math.floor(Math.random() * UNAMBIGUOUS.length)]).join('');
  const pinHash = opts.withPin ? await bcrypt.hash('123', 10) : null;

  await sql.query(`INSERT INTO schools (id, name) VALUES ($1, $2);`, [schoolId, `E2E School ${opts.tag}`]);
  await sql.query(
    `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, $3, 'Class 3', $4);`,
    [classId, schoolId, `Class 3 ${opts.tag}`, classCode]
  );

  const students: SeededStudent[] = [];
  for (const [i, name] of opts.students.entries()) {
    const id = `stud_e2e_${i}_${suffix}`;
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar, pin_hash) VALUES ($1, $2, $3, $4, $5, 'avatar_1', $6);`,
      [id, schoolId, classId, name, String(i + 1).padStart(2, '0'), pinHash]
    );
    students.push({ id, name });
  }

  let admin: SeededClass['admin'] = null;
  if (opts.withAdmin) {
    admin = { id: `adm_e2e_${suffix}`, username: `e2e_admin_${suffix}`, password: `e2e-pass-${suffix}-x` };
    await sql.query(
      `INSERT INTO admins (id, username, password_hash, role, school_id) VALUES ($1, $2, $3, 'school_admin', $4);`,
      [admin.id, admin.username, await bcrypt.hash(admin.password, 10), schoolId]
    );
  }

  return { schoolId, classId, classCode, students, admin };
}

/** Removes everything seedClass created, including attempts/progress/sessions written during the test. */
export async function cleanupClass(seeded: SeededClass): Promise<void> {
  const sql = testDb();
  const ids = seeded.students.map((s) => s.id);
  await sql.query('DELETE FROM attempts WHERE student_id = ANY($1);', [ids]);
  await sql.query('DELETE FROM activity_progress WHERE student_id = ANY($1);', [ids]);
  await sql.query('DELETE FROM learning_sessions WHERE student_id = ANY($1);', [ids]);
  await sql.query('DELETE FROM students WHERE school_id = $1;', [seeded.schoolId]);
  await sql.query('DELETE FROM admins WHERE school_id = $1;', [seeded.schoolId]);
  await sql.query('DELETE FROM classes WHERE school_id = $1;', [seeded.schoolId]);
  await sql.query('DELETE FROM schools WHERE id = $1;', [seeded.schoolId]);
}

/** Logs a seeded student in through the PC setup and name tap; ends on the subjects page. */
export async function loginStudent(page: Page, seeded: SeededClass, studentName: string, baseUrl = ''): Promise<void> {
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`HTTP ${resp.status()} on ${resp.request().method()} ${resp.url()}`);
    }
  });

  await page.addInitScript(({ schoolId, classId }) => {
    localStorage.setItem('sara_school_id', schoolId);
    localStorage.setItem('sara_class_id', classId);
  }, { schoolId: seeded.schoolId, classId: seeded.classId });

  await page.goto(`${baseUrl}/students`);
  await page.evaluate(({ schoolId, classId }) => {
    localStorage.setItem('sara_school_id', schoolId);
    localStorage.setItem('sara_class_id', classId);
  }, { schoolId: seeded.schoolId, classId: seeded.classId });

  console.log('[loginStudent] on /students, waiting for button...');
  const studentBtn = page.getByRole('button', { name: `Select student ${studentName}` });
  await studentBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('[loginStudent] button visible, clicking...');
  await studentBtn.click();
  console.log('[loginStudent] clicked, current URL:', page.url());

  // Check if PIN modal appeared
  const pinInput = page.locator('input[type="password"]');
  if (await pinInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log('[loginStudent] PIN modal appeared! Entering 123...');
    await pinInput.fill('123');
    await page.locator('button[type="submit"]').click();
  }

  const resumeCard = page.getByTestId('session-resume-card');
  if (await resumeCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('[loginStudent] resume card visible, clicking choose subject...');
    await resumeCard.getByRole('button', { name: /Choose Subject|பாடங்களைத் தேர்வுசெய்/ }).click();
  }

  console.log('[loginStudent] waiting for subjects URL, current URL:', page.url());
  await page.waitForURL(/\/(subjects|classes\/\d+\/subjects)/, { timeout: 15000 });
  console.log('[loginStudent] successfully navigated to:', page.url());
}

/** Logs the seeded school admin in through /admin/login; ends on the dashboard. */
export async function loginAdmin(page: Page, seeded: SeededClass): Promise<void> {
  if (!seeded.admin) throw new Error('seedClass was called without withAdmin');
  await page.goto('/admin/login');
  await page.fill('#admin-username', seeded.admin.username);
  await page.fill('#admin-password', seeded.admin.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
}

/** Local progress for the logged-in student, read the way the app stores it (keyed by server student id). */
export async function localProgressFor(page: Page, studentId: string): Promise<Record<string, { completed: boolean; correct: boolean }>> {
  return page.evaluate((id) => {
    const snap = JSON.parse(localStorage.getItem('sa.learning.progress.v2') || '{}');
    return (snap.students && snap.students[id]) || {};
  }, studentId);
}
