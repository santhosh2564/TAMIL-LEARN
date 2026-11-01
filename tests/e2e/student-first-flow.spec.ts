import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { seedClass, testDb } from './helpers/loginStudent';

// Clear storage state so this test starts fresh (unauthenticated student & admin)
test.use({ storageState: { cookies: [], origins: [] } });

const screenshotsDir = path.resolve(process.cwd(), 'playwright-screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

let seededSchoolId: string;
let seededStudentName = 'Malar';

test.beforeAll(async () => {
  const seeded = await seedClass({
    tag: 'flow',
    students: [seededStudentName],
  });
  seededSchoolId = seeded.schoolId;
});

test.afterAll(async () => {
  const sql = testDb();
  if (seededSchoolId) {
    await sql.query(`DELETE FROM students WHERE school_id = $1`, [seededSchoolId]).catch(() => {});
    await sql.query(`DELETE FROM schools WHERE id = $1`, [seededSchoolId]).catch(() => {});
  }
});

test.describe('Student-First Default Entry Flow & Settings Admin Access', () => {
  test('1. Root URL "/" opens Student Welcome / Name Entry screen by default without admin authentication', async ({ page }) => {
    await page.goto('/');

    // 1. Must NOT redirect to /admin/login
    expect(page.url()).not.toContain('/admin/login');
    expect(page.url()).toBe('http://localhost:4173/');

    // 2. Student Welcome branding and heading must be visible
    await expect(page.locator('text=TAMIL-LEARN · கல்வி தளம்')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: "Welcome! Let's Learn" })).toBeVisible();
    await expect(page.locator('text=வணக்கம்! கற்கலாம் வாருங்கள்')).toBeVisible();

    // 3. Name entry input and Continue button must be present
    const nameInput = page.getByPlaceholder(/Type your name \/ உங்கள் பெயரை உள்ளிடவும்/i);
    await expect(nameInput).toBeVisible();
    const continueBtn = page.getByRole('button', { name: /Continue \/ தொடர்க/i });
    await expect(continueBtn).toBeVisible();

    // 4. Capture screenshot of Student Welcome screen
    await page.screenshot({ path: path.join(screenshotsDir, '1-student-welcome.png'), fullPage: true });
  });

  test('2. Student name validation rejects unknown students without creating records', async ({ page }) => {
    await page.goto('/');

    const nameInput = page.getByPlaceholder(/Type your name \/ உங்கள் பெயரை உள்ளிடவும்/i);
    await nameInput.fill('NonExistentStudent123');

    const continueBtn = page.getByRole('button', { name: /Continue \/ தொடர்க/i });
    await continueBtn.click();

    // Validation error must appear
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('was not found in');
  });

  test('3. Selecting a student from roster opens Student Dashboard (/subjects) with Tamil & English courses', async ({ page }) => {
    // Navigate to root with this school configured in localStorage
    await page.addInitScript((schoolId) => {
      localStorage.setItem('sara_school_id', schoolId);
    }, seededSchoolId);

    await page.goto('/');

    // Wait for student roster to finish loading
    await expect(page.locator('button[aria-label^="Select student"]').first()).toBeVisible({ timeout: 10000 });

    // Type the student name into the name input
    const nameInput = page.getByPlaceholder(/Type your name \/ உங்கள் பெயரை உள்ளிடவும்/i);
    await nameInput.fill(seededStudentName);

    // Click Continue
    const continueBtn = page.getByRole('button', { name: /Continue \/ தொடர்க/i });
    await continueBtn.click();

    // Verify redirected to /subjects
    await expect(page).toHaveURL(/\/subjects/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: new RegExp(`வணக்கம், ${seededStudentName}!|வணக்கம்!`, 'i') })).toBeVisible();

    // Two prominent course cards: Tamil and English
    const tamilCard = page.locator('[data-testid="course-card-tamil"]');
    const englishCard = page.locator('[data-testid="course-card-english"]');
    await expect(tamilCard).toBeVisible();
    await expect(englishCard).toBeVisible();

    // Verify activity families in Tamil card
    await expect(tamilCard).toContainText('தமிழ் (Tamil)');
    await expect(tamilCard).toContainText('Start Learning');

    // Verify activity families in English card
    await expect(englishCard).toContainText('English (ஆங்கிலம்)');
    await expect(englishCard).toContainText('Start Learning');

    // Capture screenshot of Student Dashboard
    await page.screenshot({ path: path.join(screenshotsDir, '2-student-dashboard.png'), fullPage: true });
  });

  test('4. Settings page contains Administrator Access card with Admin Login button', async ({ page }) => {
    await page.goto('/settings');

    // Verify Settings heading
    await expect(page.getByRole('heading', { name: /Settings \(அமைப்புகள்\)/i })).toBeVisible();

    // Verify Administrator Access section
    const adminSection = page.locator('[data-testid="admin-access-section"]');
    await expect(adminSection).toBeVisible();
    await expect(adminSection).toContainText('Administrator Access');
    await expect(adminSection).toContainText('நிர்வாகி அணுகல்');

    // Verify Admin Login button
    const adminLoginBtn = page.locator('[data-testid="admin-login-button"]');
    await expect(adminLoginBtn).toBeVisible();
    await expect(adminLoginBtn).toContainText('Sign In as Administrator');

    // Capture screenshot of Settings page
    await page.screenshot({ path: path.join(screenshotsDir, '3-settings-admin-login.png'), fullPage: true });

    // Clicking Admin Login navigates to /admin/login
    await adminLoginBtn.click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: /Admin Login/i })).toBeVisible();
  });

  test('5. Unauthenticated access to /admin/* redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin/schools');
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto('/admin/reports');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
