import { test, expect } from '@playwright/test';

test('verifies Q110 displays the image of soil (மண்) and interactive word completion', async ({ page }) => {
  await page.goto('http://localhost:5173/session/3/tamil/play?activityId=Q110');

  // Verify the image is present and visible
  const image = page.locator('img[data-testid="activity-asset-image"]');
  await expect(image).toBeVisible({ timeout: 10000 });
  const src = await image.getAttribute('src');
  expect(src).toContain('/assets/class-3/tamil/term-1/images/Q110_Mann.jpg');

  // Verify prompt and blank slot
  await expect(page.locator('text=படத்தில் காணப்படுவது:')).toBeVisible();
  await expect(page.locator('text=ம +')).toBeVisible();

  // Take screenshot before selection
  await page.screenshot({ path: 'C:/Users/santh/.gemini/antigravity-ide/brain/2ca22897-c1dc-45ab-b7c9-0a24f0d05a57/q110_fixed_localhost.png' });

  // Click on the correct option "ண்"
  const optionButton = page.locator('button', { hasText: 'ண்' });
  await expect(optionButton).toBeVisible();
  await optionButton.click();

  // Verify Check Answer button is enabled and click it
  const checkButton = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
  await expect(checkButton).toBeEnabled();
  await checkButton.click();

  // Verify success feedback
  await expect(page.locator('text=சரியான விடை!')).toBeVisible();

  // Take screenshot after selection and validation
  await page.screenshot({ path: 'C:/Users/santh/.gemini/antigravity-ide/brain/2ca22897-c1dc-45ab-b7c9-0a24f0d05a57/q110_success_localhost.png' });
});
