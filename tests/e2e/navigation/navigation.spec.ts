import { test, expect } from '@playwright/test';

test.describe('Full Navigation Verification', () => {
  test('verifies complete navigation journey from Home to Activity and Results', async ({ page }) => {
    // 1. Home
    await page.goto('/');
    await expect(page.locator('h1', { hasText: 'Learn. Play. Grow.' })).toBeVisible();

    // 2. Click Start Learning -> Navigates to /students (if no student active)
    await page.click('button:has-text("Start Learning")');
    await expect(page).toHaveURL(/\/students/);

    // 3. Create a student
    const studentInput = page.locator('#student-name-input');
    await expect(studentInput).toBeVisible();
    await studentInput.fill('QA Navigator');
    await page.click('button:has-text("Start Learning")');

    // 4. Navigates to Subject Selection (/classes/3/subjects)
    await expect(page).toHaveURL(/\/classes\/3\/subjects/);
    await expect(page.getByRole('heading', { name: 'தமிழ்' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'English' })).toBeVisible();

    // 5. Select Tamil -> Navigates to Tamil Learning Area (/classes/3/subjects/tamil)
    await page.getByRole('heading', { name: 'தமிழ்' }).click();
    await expect(page).toHaveURL(/\/classes\/3\/subjects\/tamil/);
    await expect(page.locator('h1', { hasText: 'தமிழ் கற்றல் பகுதி' })).toBeVisible();
    await expect(page.locator('text=கற்பவர்: QA Navigator')).toBeVisible();

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
    page.once('dialog', dialog => dialog.accept());
    await page.click('button:has-text("வெளியேறு")');
    await expect(page).toHaveURL(/\/classes\/3\/subjects\/tamil/);
  });

  test('verifies English curriculum navigation', async ({ page }) => {
    // Navigate directly to English learning area
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

  test('verifies browser refresh does not crash and maintains active state', async ({ page }) => {
    // Setup student in localStorage
    await page.goto('/students');
    const input = page.locator('#student-name-input');
    if (await input.isVisible()) {
      await input.fill('Persistent Student');
      await page.click('button:has-text("Start Learning")');
    }

    await page.goto('/classes/3/subjects/tamil');
    await expect(page.locator('text=கற்பவர்: Persistent Student')).toBeVisible();

    // Refresh page
    await page.reload();
    await expect(page.locator('text=கற்பவர்: Persistent Student')).toBeVisible();
    await expect(page.locator('h1', { hasText: 'தமிழ் கற்றல் பகுதி' })).toBeVisible();
  });
});
