import { test, expect, Page, Browser } from '@playwright/test';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

/**
 * T10. Cross-desktop session resume and offline outbox, against the TEST database only.
 * Run with playwright.cross-desktop.config.ts (vite preview with DATABASE_URL = TEST_DATABASE_URL).
 *
 * (a) Desktop A answers 3 questions and taps "I'm done".
 * (b) Desktop B, a fresh browser context, logs in and resumes at question 4.
 * (c) An admin context sees exactly 3 attempts for that student.
 * (d) Offline variant: answer while offline, reconnect -> exactly 1 row in attempts.
 */

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) throw new Error('TEST_DATABASE_URL is not set.');
if (process.env.DATABASE_URL && testDbUrl.trim() === process.env.DATABASE_URL.trim()) {
  throw new Error('TEST_DATABASE_URL equals DATABASE_URL (production). Refusing to run.');
}

const PIN = ['sun', 'star', 'tree'];
const PIN_BUTTON_LABELS = ['சூரியன் / Sun', 'நட்சத்திரம் / Star', 'மரம் / Tree'];
const SESSION_SIZE = 5;

const suffix = Date.now();
const schoolId = `sch_e2e_${suffix}`;
const classId = `cls_e2e_${suffix}`;
const UNAMBIGUOUS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const classCode = Array.from({ length: 6 }, () => UNAMBIGUOUS[Math.floor(Math.random() * UNAMBIGUOUS.length)]).join('');
const studentA = { id: `stud_e2e_a_${suffix}`, name: 'Kavin' };
const studentOffline = { id: `stud_e2e_off_${suffix}`, name: 'Malar' };
const admin = { id: `adm_e2e_${suffix}`, username: `e2e_admin_${suffix}`, password: `e2e-pass-${suffix}-x` };

// correctAnswer for every Tamil activity, straight from the content manifests.
const correctAnswers = new Map<string, string>();
for (let m = 1; m <= 8; m++) {
  const file = path.resolve(process.cwd(), `src/content/class-3/tamil/module-${m}/activities.json`);
  for (const a of JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ id: string; correctAnswer: string }>) {
    correctAnswers.set(a.id, a.correctAnswer);
  }
}

let sql: NeonQueryFunction<false, false>;

async function countAttempts(studentId: string): Promise<number> {
  const rows = (await sql.query('SELECT count(*)::int AS n FROM attempts WHERE student_id = $1;', [studentId])) as {
    n: number;
  }[];
  return rows[0].n;
}

async function waitForActiveSession(studentId: string) {
  let row: { id: string; activity_ids: string[]; current_index: number } | undefined;
  await expect
    .poll(
      async () => {
        const rows = (await sql.query(
          `SELECT id, activity_ids, current_index FROM learning_sessions WHERE student_id = $1 AND status = 'active';`,
          [studentId]
        )) as typeof row[];
        row = rows[0];
        return rows.length;
      },
      { timeout: 15000 }
    )
    .toBe(1);
  return row!;
}

async function loginStudent(page: Page, name: string) {
  await page.goto(`/c/${classCode}`);
  await page.getByRole('button', { name: `Student ${name}` }).click();
  for (const label of PIN_BUTTON_LABELS) {
    await page.getByRole('button', { name: label, exact: true }).click();
  }
  await expect(page).toHaveURL(/\/classes\/3\/subjects$/, { timeout: 15000 });
}

async function answerCorrectly(page: Page, activityId: string) {
  const answer = correctAnswers.get(activityId);
  expect(answer, `manifest correctAnswer for ${activityId}`).toBeTruthy();
  await page.locator('button[lang="ta"]').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(answer!)}\\s*$`) }).first().click();
  await page.getByRole('button', { name: /விடையைச் சரிபார்/ }).click();
  await expect(page.getByText('சரியான விடை!').first()).toBeVisible({ timeout: 10000 });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  return { context, page };
}

test.describe('T10: cross-desktop resume and offline outbox (TEST database)', () => {
  test.beforeAll(async () => {
    sql = neon(testDbUrl);
    const host = new URL(testDbUrl).host;
    console.log(`[setup] TEST database endpoint: ${host}`);

    const pinHash = await bcrypt.hash(PIN.join('-'), 10);
    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'E2E School');`, [schoolId]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 3 E2E', 'Class 3', $3);`,
      [classId, schoolId, classCode]
    );
    for (const [i, s] of [studentA, studentOffline].entries()) {
      await sql.query(
        `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar, pin_hash) VALUES ($1, $2, $3, $4, $5, 'avatar_1', $6);`,
        [s.id, schoolId, classId, s.name, String(i + 1).padStart(2, '0'), pinHash]
      );
    }
    await sql.query(
      `INSERT INTO admins (id, username, password_hash, role, school_id) VALUES ($1, $2, $3, 'school_admin', $4);`,
      [admin.id, admin.username, await bcrypt.hash(admin.password, 10), schoolId]
    );
    console.log(`[setup] seeded school ${schoolId}, class code ${classCode}, students ${studentA.id}, ${studentOffline.id}`);
  });

  test.afterAll(async () => {
    const ids = [studentA.id, studentOffline.id];
    await sql.query('DELETE FROM attempts WHERE student_id = ANY($1);', [ids]);
    await sql.query('DELETE FROM activity_progress WHERE student_id = ANY($1);', [ids]);
    await sql.query('DELETE FROM learning_sessions WHERE student_id = ANY($1);', [ids]);
    await sql.query('DELETE FROM students WHERE id = ANY($1);', [ids]);
    await sql.query('DELETE FROM admins WHERE id = $1;', [admin.id]);
    await sql.query('DELETE FROM classes WHERE id = $1;', [classId]);
    await sql.query('DELETE FROM schools WHERE id = $1;', [schoolId]);
  });

  test('desktop A answers 3 -> desktop B resumes at question 4 -> admin sees exactly 3 attempts', async ({ browser }) => {
    // (a) Desktop A
    const a = await newPage(browser);
    await loginStudent(a.page, studentA.name);
    await a.page.goto(`/session/3/tamil/play?category=spelling-choice&size=${SESSION_SIZE}`);
    const session = await waitForActiveSession(studentA.id);
    console.log(`[a] server session ${session.id}: ${session.activity_ids.join(', ')}`);

    for (let i = 0; i < 3; i++) {
      await expect(a.page.getByText(`செயல் ${i + 1} / ${SESSION_SIZE}`)).toBeVisible();
      await answerCorrectly(a.page, session.activity_ids[i]);
      await a.page.getByRole('button', { name: 'தொடர்க' }).click();
      console.log(`[a] answered question ${i + 1} (${session.activity_ids[i]})`);
    }
    await expect(a.page.getByText(`செயல் 4 / ${SESSION_SIZE}`)).toBeVisible();
    await expect.poll(() => countAttempts(studentA.id), { timeout: 15000 }).toBe(3);
    await expect
      .poll(async () => {
        const rows = (await sql.query('SELECT current_index FROM learning_sessions WHERE id = $1;', [session.id])) as {
          current_index: number;
        }[];
        return rows[0].current_index;
      })
      .toBe(3);

    await a.page.getByRole('button', { name: 'வெளியேறு' }).click();
    await a.page.getByRole('button', { name: "முடித்துவிட்டேன் / I'm done" }).click();
    await expect(a.page).toHaveURL(/\/$/);
    const sessionCheck = await a.page.request.get('/api/student/session');
    expect(sessionCheck.status()).toBe(401);
    console.log(`[a] tapped "I'm done"; /api/student/session -> ${sessionCheck.status()}`);
    await a.context.close();

    // (b) Desktop B: fresh context, no shared storage or cookies
    const b = await newPage(browser);
    await loginStudent(b.page, studentA.name);
    const resumeCard = b.page.getByTestId('session-resume-card');
    await expect(resumeCard).toContainText(`Question 4 of ${SESSION_SIZE}`, { timeout: 15000 });
    await resumeCard.getByRole('button').click();
    await expect(b.page.getByText(`செயல் 4 / ${SESSION_SIZE}`)).toBeVisible({ timeout: 15000 });
    const q4Answer = correctAnswers.get(session.activity_ids[3])!;
    await expect(
      b.page.locator('button[lang="ta"]').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(q4Answer)}\\s*$`) })
    ).toBeVisible();
    console.log(`[b] fresh context resumed at question 4 (${session.activity_ids[3]})`);
    await b.context.close();

    // (c) Admin context
    const adm = await newPage(browser);
    await adm.page.goto('/admin/login');
    await adm.page.fill('#admin-username', admin.username);
    await adm.page.fill('#admin-password', admin.password);
    await adm.page.locator('button[type="submit"]').click();
    await expect(adm.page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    const res = await adm.page.request.get(`/api/students/${studentA.id}/attempts`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { attempts: Array<{ activityId: string; result: string }> };
    console.log(`[c] admin sees ${body.attempts.length} attempts: ${body.attempts.map((x) => `${x.activityId}=${x.result}`).join(', ')}`);
    expect(body.attempts).toHaveLength(3);
    expect(body.attempts.map((x) => x.activityId).sort()).toEqual(session.activity_ids.slice(0, 3).sort());
    expect(await countAttempts(studentA.id)).toBe(3);
    await adm.context.close();
  });

  test('offline variant: answer while offline, reconnect -> exactly 1 attempts row', async ({ browser }) => {
    const d = await newPage(browser);
    await loginStudent(d.page, studentOffline.name);
    await d.page.goto(`/session/3/tamil/play?category=spelling-choice&size=${SESSION_SIZE}`);
    const session = await waitForActiveSession(studentOffline.id);
    await expect(d.page.getByText(`செயல் 1 / ${SESSION_SIZE}`)).toBeVisible();

    await d.context.setOffline(true);
    await answerCorrectly(d.page, session.activity_ids[0]);
    await d.page.waitForTimeout(3000);
    const whileOffline = await countAttempts(studentOffline.id);
    console.log(`[d] answered ${session.activity_ids[0]} offline; attempts rows while offline: ${whileOffline}`);
    expect(whileOffline).toBe(0);

    await d.context.setOffline(false);
    await expect.poll(() => countAttempts(studentOffline.id), { timeout: 20000 }).toBe(1);
    await d.page.waitForTimeout(5000);
    const afterReconnect = await countAttempts(studentOffline.id);
    console.log(`[d] reconnected; attempts rows 5s after first sync: ${afterReconnect}`);
    expect(afterReconnect).toBe(1);
    await d.context.close();
  });
});
