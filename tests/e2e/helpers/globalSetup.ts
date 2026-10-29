/**
 * Seeds one class on the TEST database and logs its student in through /c/:code + PIN,
 * saving the cookie as the default storageState. Specs that only need "a logged-in child"
 * (content QA, navigation smoke, etc.) get it automatically; specs that test login itself
 * open their own fresh contexts.
 */
import { chromium, FullConfig } from '@playwright/test';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { seedClass, loginStudent } from './loginStudent';

export const AUTH_DIR = path.resolve(process.cwd(), 'test-results', '.auth');
export const STUDENT_STATE = path.join(AUTH_DIR, 'student.json');
export const SEED_FILE = path.join(AUTH_DIR, 'global-seed.json');

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL!;
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const sql = neon(process.env.TEST_DATABASE_URL!);
  await sql.query('DELETE FROM class_lookup_rate_limits;').catch(() => {});

  const seeded = await seedClass({ tag: 'global', students: ['Kavin'] });
  fs.writeFileSync(SEED_FILE, JSON.stringify(seeded, null, 2));

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await loginStudent(page, seeded, 'Kavin');
  await page.context().storageState({ path: STUDENT_STATE });
  await browser.close();
  console.log(`[global-setup] TEST class ${seeded.classCode}: student ${seeded.students[0].id} logged in`);
}
