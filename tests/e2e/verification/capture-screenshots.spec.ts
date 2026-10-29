import { test } from '@playwright/test';
import { seedClass, cleanupClass, loginStudent, loginAdmin, testDb, SeededClass } from '../helpers/loginStudent';
import path from 'path';
import fs from 'fs';

test.describe('Screenshots Capture (1366x768)', () => {
  test.use({
    viewport: { width: 1366, height: 768 },
    storageState: { cookies: [], origins: [] },
  });

  let seeded: SeededClass;

  test.beforeAll(async () => {
    seeded = await seedClass({
      tag: 'shots',
      students: ['Malar', 'Kavin'],
      withAdmin: true,
    });
  });

  test.beforeEach(async () => {
    await testDb().query('DELETE FROM class_lookup_rate_limits;').catch(() => {});
  });

  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  test('captures all 13 required screens at 1366x768', async ({ page, browser }) => {
    const screenshotDir = path.resolve(process.cwd(), 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });

    // 1. Home
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-01-home.png'), fullPage: true });

    // 2. /join
    await page.goto('/join');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-02-join.png'), fullPage: true });

    // 3. Class Roster (/c/:code)
    await page.goto(`/c/${seeded.classCode}`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-03-class-roster.png'), fullPage: true });

    // 4. Picture PIN modal
    await page.getByRole('button', { name: `Student ${seeded.students[0].name}` }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-04-pin-modal.png'), fullPage: true });

    // Close modal
    await page.keyboard.press('Escape').catch(() => {});

    // Log student in for protected student pages
    await loginStudent(page, seeded, seeded.students[0].name);

    // 5. Tamil subject picker (/classes/3/subjects)
    await page.goto('/classes/3/subjects');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-05-tamil-subject-picker.png'), fullPage: true });

    // 6. Tamil session (/session/3/tamil/play)
    await page.goto('/session/3/tamil/play?category=spelling-choice&size=5');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-06-tamil-session.png'), fullPage: true });

    // 7. English subject picker (/classes/3/subjects/english)
    await page.goto('/classes/3/subjects/english');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-07-english-subject-picker.png'), fullPage: true });

    // 8. English module (/classes/3/subjects/english/modules/1)
    await page.goto('/classes/3/subjects/english/modules/1');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-08-english-module.png'), fullPage: true });

    // 9. English session (/session/3/english/play)
    await page.goto('/session/3/english/play?moduleId=1&day=1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-09-english-session.png'), fullPage: true });

    // 10. Session results (/session/results)
    // Visit or play to results
    await page.goto('/session/results');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot-10-session-results.png'), fullPage: true });

    // 11. Admin login (/admin/login)
    const adminPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await adminPage.goto('/admin/login');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.screenshot({ path: path.join(screenshotDir, 'screenshot-11-admin-login.png'), fullPage: true });

    // 12. Admin dashboard (/admin/dashboard)
    await loginAdmin(adminPage, seeded);
    await adminPage.goto('/admin/dashboard');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.screenshot({ path: path.join(screenshotDir, 'screenshot-12-admin-dashboard.png'), fullPage: true });

    // 13. Print cards (/admin/classes/:id/print)
    await adminPage.goto(`/admin/classes/${seeded.classId}/print`);
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.screenshot({ path: path.join(screenshotDir, 'screenshot-13-print-cards.png'), fullPage: true });

    await adminPage.close();
  });
});
