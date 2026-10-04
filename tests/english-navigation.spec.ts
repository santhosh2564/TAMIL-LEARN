import { test, expect } from '@playwright/test';

test.describe('Phase C: English Navigation, Module UI & Browser QA', () => {
  test('Complete Flow: Home -> Classes -> Class 3 -> English -> Module 1 -> Day 1 -> Practice -> Exit', async ({ page }) => {
    // 1. Home
    await page.goto('http://localhost:5173/');
    const chooseClassBtn = page.getByRole('button', { name: /Choose Class/i });
    await expect(chooseClassBtn).toBeVisible();
    await chooseClassBtn.click();

    // 2. Classes
    await expect(page).toHaveURL(/.*\/classes/);
    const class3Card = page.getByText('வகுப்பு 3');
    await expect(class3Card).toBeVisible();
    await class3Card.click();

    // 3. Subjects
    await expect(page).toHaveURL(/.*\/classes\/3\/subjects/);
    const tamilCard = page.getByText('Tamil').first();
    const englishCard = page.getByText('English').first();
    await expect(tamilCard).toBeVisible();
    await expect(englishCard).toBeVisible();

    // English must not have 'Coming Soon'
    await englishCard.click();

    // 4. English Learning Area
    await expect(page).toHaveURL(/.*\/classes\/3\/subjects\/english/);
    await expect(page.getByRole('heading', { name: 'English Modules' })).toBeVisible();
    await expect(page.getByText('958 Words · 1238 Total Practice Activities')).toBeVisible();

    // Verify 8 modules are rendered
    for (let i = 1; i <= 8; i++) {
      await expect(page.getByLabel(new RegExp(`Module ${i}:`, 'i'))).toBeVisible();
    }

    // 5. Open Module 1
    const m1Card = page.getByLabel(/Module 1:/i);
    await m1Card.click();

    await expect(page).toHaveURL(/.*\/classes\/3\/subjects\/english\/modules\/1/);
    await expect(page.getByRole('heading', { name: /Module 1/i })).toBeVisible();
    await expect(page.getByText('120 New Words')).toBeVisible();
    await expect(page.getByText('5 Days (120 Total Activities)')).toBeVisible();

    // Verify all 5 days are visible
    for (let d = 1; d <= 5; d++) {
      await expect(page.getByText(`Day ${d} Practice`)).toBeVisible();
    }

    // 6. Start Day 1
    const startDay1Btn = page.getByRole('button', { name: /Start/i }).first();
    await startDay1Btn.click();

    await expect(page).toHaveURL(/.*\/session\/3\/english\/play\?module=1&day=1&size=all/);
    await expect(page.getByText(/Activity 1 \/ 24/i)).toBeVisible();

    // 7. Verify Exit confirmation handling
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Are you sure you want to exit');
      await dialog.accept();
    });

    const exitBtn = page.getByRole('button', { name: 'Exit' });
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();

    // Should return to module 1 detail
    await expect(page).toHaveURL(/.*\/classes\/3\/subjects\/english\/modules\/1/);

    // 8. Test Module 2 (reviews check)
    await page.goto('http://localhost:5173/classes/3/subjects/english/modules/2');
    await expect(page.getByText('Module 2 - Phonemic Building & Core Vocabulary')).toBeVisible();
    await expect(page.getByText('120 New Words')).toBeVisible();
    await expect(page.getByText('40 Review Activities')).toBeVisible();
    await expect(page.getByText('5 Days (160 Total Activities)')).toBeVisible();

    // 9. Test Invalid Module (Error Handling)
    await page.goto('http://localhost:5173/classes/3/subjects/english/modules/9');
    await expect(page.getByText('Module not found')).toBeVisible();
    const backBtn = page.getByRole('button', { name: 'Back to Modules' });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/.*\/classes\/3\/subjects\/english/);

    // 10. Tamil Regression Check
    await page.goto('http://localhost:5173/classes/3/subjects/tamil');
    await expect(page.getByText('தமிழ் கற்றல் பகுதி')).toBeVisible();
    await expect(page.getByText('கலப்பு பயிற்சி')).toBeVisible();
  });

  test('Mobile Viewport 375x667 Check - No horizontal scrollbar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // English Learning Area on mobile
    await page.goto('http://localhost:5173/classes/3/subjects/english');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // No horizontal overflow

    // Module detail on mobile
    await page.goto('http://localhost:5173/classes/3/subjects/english/modules/1');
    await page.waitForLoadState('networkidle');

    const mScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const mClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(mScrollWidth).toBeLessThanOrEqual(mClientWidth + 1);
  });
});
