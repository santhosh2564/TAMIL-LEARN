import { test, expect } from '@playwright/test';
import fs from 'fs';
import { seedClass, cleanupClass, SeededClass } from '../helpers/loginStudent';
import { SEED_FILE } from '../helpers/globalSetup';

test.describe('Full Navigation Verification: fresh browser', () => {
  // A browser that has never logged in: no student cookie.
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;
  test.beforeAll(async () => {
    seeded = await seedClass({ tag: 'nav', students: ['Navigator'] });
  });
  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  test('verifies complete navigation journey from Home to Activity and back', async ({ page }) => {
    // 1. Home
    await page.goto('/');
    await expect(page.locator('h1', { hasText: 'Learn. Play. Grow.' })).toBeVisible();

    // 2. Start Learning without a session -> class-code page
    await page.click('button:has-text("Start Learning")');
    await expect(page).toHaveURL(/\/join$/);
    await expect(page.getByText('Ask your teacher for your class link')).toBeVisible();

    // 3. Type the class code -> class roster -> tap name -> picture PIN
    await page.getByRole('textbox', { name: /class code/i }).fill(seeded.classCode.toLowerCase());
    await page.getByRole('button', { name: /open class/i }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${seeded.classCode}$`));
    await page.getByRole('button', { name: 'Student Navigator' }).click();
    for (const label of ['சூரியன் / Sun', 'நட்சத்திரம் / Star', 'மரம் / Tree']) {
      await page.getByRole('button', { name: label, exact: true }).click();
    }

    // 4. Subject Selection (/classes/3/subjects)
    await expect(page).toHaveURL(/\/classes\/3\/subjects$/);
    await expect(page.getByRole('heading', { name: 'தமிழ்' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'English' })).toBeVisible();

    // 5. Select Tamil -> Tamil Learning Area
    await page.getByRole('heading', { name: 'தமிழ்' }).click();
    await expect(page).toHaveURL(/\/classes\/3\/subjects\/tamil/);
    await expect(page.locator('h1', { hasText: 'தமிழ் கற்றல் பகுதி' })).toBeVisible();
    await expect(page.locator('text=கற்பவர்: Navigator')).toBeVisible();

    // 6. Select a Category: "சரியான எழுத்துக்கூட்டல்" (Spelling Choice)
    await page.click('text=சரியான எழுத்துக்கூட்டல்');
    await expect(page).toHaveURL(/\/session\/3\/tamil\/setup\?category=spelling-choice/);

    // 7. On Setup page, select 5 questions and click Start Practice
    const fiveBtn = page.locator('button', { hasText: '5' });
    if (await fiveBtn.isVisible()) {
      await fiveBtn.click();
    }
    await page.click('button:has-text("பயிற்சியைத் தொடங்கு")');

    // 8. Session Play page loads
    await expect(page).toHaveURL(/\/session\/3\/tamil\/play/);
    await expect(page.locator('button', { hasText: 'வெளியேறு' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'விடையைச் சரிபார்' })).toBeVisible();

    // 9. Back navigation test: Exit session
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('button:has-text("வெளியேறு")');
    await expect(page).toHaveURL(/\/classes\/3\/subjects\/tamil/);
  });

  test('learning pages without a student session redirect to the class-code page', async ({ page }) => {
    for (const url of ['/classes/3/subjects', '/classes/3/subjects/tamil', '/session/3/tamil/play?activityId=Q010']) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/join$/);
    }
  });
});

test.describe('Full Navigation Verification: logged-in student', () => {
  // Uses the student logged in by global setup (default storageState).
  const globalStudentName = () =>
    (JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as SeededClass).students[0].name;

  test('verifies English curriculum navigation', async ({ page }) => {
    await page.goto('/classes/3/subjects/english');
    await expect(page.locator('h1', { hasText: 'English Modules' })).toBeVisible();

    // Verify 8 modules are listed
    for (let m = 1; m <= 8; m++) {
      await expect(page.locator(`text=Module ${m}`).first()).toBeVisible();
    }

    // Click on Module 1 card
    await page.locator('div[aria-label^="Module 1:"]').first().click();
    await expect(page).toHaveURL(/\/classes\/3\/subjects\/english\/modules\/1/);
    await expect(page.locator('h1')).toBeVisible();

    // Back button returns to English Learning Area
    await page.click('button[aria-label="Back to English Modules"]');
    await expect(page).toHaveURL(/\/classes\/3\/subjects\/english/);
  });

  test('verifies browser refresh does not crash and keeps the student session', async ({ page }) => {
    const name = globalStudentName();
    await page.goto('/classes/3/subjects/tamil');
    await expect(page.locator(`text=கற்பவர்: ${name}`)).toBeVisible();

    await page.reload();
    await expect(page.locator(`text=கற்பவர்: ${name}`)).toBeVisible();
    await expect(page.locator('h1', { hasText: 'தமிழ் கற்றல் பகுதி' })).toBeVisible();
  });
});
