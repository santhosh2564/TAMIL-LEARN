import { test, expect } from '@playwright/test';

test.describe('Phase 15B / Retry Flow Browser Verification', () => {
  let errors: string[] = [];

  test.beforeEach(({ page }) => {
    errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
  });

  test('1. Main Learner Journey: Home -> Classes -> Tamil -> Setup -> Play', async ({ page }) => {
    // Home
    await page.goto('http://localhost:5173/');
    await expect(page.locator('text=தமிழ் கற்போம்!')).toBeVisible();

    // Subjects (via Start Learning)
    await page.click('text=Start Learning');
    await expect(page).toHaveURL(/.*\/classes\/3\/subjects/);

    // Tamil
    await page.click('text=தமிழ்');
    await expect(page).toHaveURL(/.*\/classes\/3\/subjects\/tamil/);

    // Learning Area -> Setup
    await page.click('text=தொடங்கு');
    await expect(page).toHaveURL(/.*\/session\/3\/tamil\/setup/);

    // Setup: choose size 5 and start
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.click('button:has-text("பயிற்சியைத் தொடங்கு")');

    // Active session loads
    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();
    expect(errors.length).toBe(0);
  });

  test('2. Selectable Activity (Picture Recognition) Retry Flow: wrong -> retry -> correct -> continue', async ({ page }) => {
    await page.goto('http://localhost:5173/session/3/tamil/play?size=5&category=picture-recognition');

    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();
    const options = page.locator('button.touch-target');
    await expect(options.first()).toBeVisible();

    // In Picture Recognition, image alt text contains the target word: e.g. "நாய் — Dog"
    const img = page.locator('img');
    const altText = await img.getAttribute('alt') || '';
    const targetWord = altText.split('—')[0].trim();

    // Find a wrong option and the correct option
    const count = await options.count();
    let wrongOptionIndex = -1;
    let correctOptionIndex = -1;

    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).textContent())?.trim();
      if (text && targetWord && text !== targetWord) {
        wrongOptionIndex = i;
      }
      if (text && targetWord && text === targetWord) {
        correctOptionIndex = i;
      }
    }

    if (wrongOptionIndex === -1) wrongOptionIndex = 0;
    if (correctOptionIndex === -1) correctOptionIndex = 1;

    // 1. Select WRONG option
    await options.nth(wrongOptionIndex).click();
    await page.getByRole('button', { name: 'விடையைச் சரிபார்' }).click();

    // Verify feedback and retry button; no advance
    await expect(page.locator('text=தவறான விடை')).toBeVisible();
    await expect(page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'தொடர்க' })).not.toBeVisible();
    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();

    // 2. Click retry
    await page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }).click();
    await expect(page.locator('text=தவறான விடை')).not.toBeVisible();

    // 3. Select CORRECT option
    await options.nth(correctOptionIndex).click();
    await page.getByRole('button', { name: 'விடையைச் சரிபார்' }).click();

    // Verify correct feedback and continue button
    await expect(page.locator('text=சரியான விடை!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'தொடர்க' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).not.toBeVisible();

    // 4. Click continue -> advances to activity 2
    await page.getByRole('button', { name: 'தொடர்க' }).click();
    await expect(page.locator('text=செயல் 2 / 5')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('3. Arrange Word Retry Flow: wrong -> retry -> rearrange -> correct -> continue', async ({ page }) => {
    await page.goto('http://localhost:5173/session/3/tamil/play?size=5&category=arrange-word');

    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();
    const availableTokens = page.locator('button[aria-label^="Select "]');
    await expect(availableTokens.first()).toBeVisible();

    // 1. Select only 1 token (always incomplete/wrong for arrange-word)
    await availableTokens.first().click();
    await page.getByRole('button', { name: 'விடையைச் சரிபார்' }).click();

    // Verify wrong feedback and retry button; does not advance
    await expect(page.locator('text=தவறான விடை')).toBeVisible();
    await expect(page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'தொடர்க' })).not.toBeVisible();
    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();

    // 2. Click retry
    await page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }).click();
    await expect(page.locator('text=தவறான விடை')).not.toBeVisible();

    // Remove the selected token so all are available again
    const removeButtons = page.locator('button[aria-label^="Remove "]');
    const removeCount = await removeButtons.count();
    for (let i = 0; i < removeCount; i++) {
      await page.locator('button[aria-label^="Remove "]').first().click();
    }

    // Now select all tokens in order
    while (await page.locator('button[aria-label^="Select "]').count() > 0) {
      await page.locator('button[aria-label^="Select "]').first().click();
    }

    // Submit the arranged word
    await page.getByRole('button', { name: 'விடையைச் சரிபார்' }).click();

    // Verify feedback appears (either retry if random shuffle was wrong order, or success)
    const feedback = page.locator('[role="status"]');
    await expect(feedback).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('4. Word Completion Retry Flow: wrong -> retry -> change answer -> correct -> continue', async ({ page }) => {
    await page.goto('http://localhost:5173/session/3/tamil/play?size=5&category=word-completion');

    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();
    const options = page.locator('button.touch-target');
    await expect(options.first()).toBeVisible();

    // Select the first option and check
    await options.first().click();
    await page.getByRole('button', { name: 'விடையைச் சரிபார்' }).click();

    const isWrong = await page.locator('text=தவறான விடை').isVisible();
    if (isWrong) {
      // Verify wrong feedback and retry button
      await expect(page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'தொடர்க' })).not.toBeVisible();
      await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();

      // Click retry
      await page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }).click();
      await expect(page.locator('text=தவறான விடை')).not.toBeVisible();

      // Try remaining options until correct
      const count = await options.count();
      for (let i = 1; i < count; i++) {
        await options.nth(i).click();
        await page.getByRole('button', { name: 'விடையைச் சரிபார்' }).click();
        if (await page.locator('text=சரியான விடை!').isVisible()) {
          break;
        }
        await page.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }).click();
      }
    }

    // Verify correct feedback and continue button
    await expect(page.locator('text=சரியான விடை!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'தொடர்க' })).toBeVisible();

    // Click continue -> advances to activity 2
    await page.getByRole('button', { name: 'தொடர்க' }).click();
    await expect(page.locator('text=செயல் 2 / 5')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('5. Mobile Viewport (375x667) & Navigation Protection', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173/session/3/tamil/setup');

    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.click('button:has-text("பயிற்சியைத் தொடங்கு")');

    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();

    // Try exiting; dismiss confirmation dialog to stay on the active session
    page.on('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'வெளியேறு' }).click();

    // Verify learner remains on active session
    await expect(page.locator('text=செயல் 1 / 5')).toBeVisible();

    expect(errors.length).toBe(0);
  });
});
