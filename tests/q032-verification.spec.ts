import { test, expect } from '@playwright/test';

test('verifies Q032 options: correct answer is ஒளி and wrong options are ஒளீ, ஔ, ஓளி', async ({ page }) => {
  await page.goto('http://localhost:5173/session/3/tamil/play?activityId=Q032');

  // Verify prompt
  await expect(page.locator('text=சரியான தமிழ்ச் சொல்லைத் தேர்ந்தெடுக்கவும்.')).toBeVisible();

  // Verify all 4 options exist
  await expect(page.getByRole('button', { name: 'ஒளி', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ஒளீ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ஔ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ஓளி', exact: true })).toBeVisible();

  // Take screenshot of Q032 with updated options
  await page.screenshot({ path: 'C:/Users/santh/.gemini/antigravity-ide/brain/2ca22897-c1dc-45ab-b7c9-0a24f0d05a57/q032_options_localhost.png' });

  // Select correct option 'ஒளி'
  const correctOption = page.getByRole('button', { name: 'ஒளி', exact: true });
  await correctOption.click();

  // Check Answer
  const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
  await expect(checkBtn).toBeEnabled();
  await checkBtn.click();

  // Verify success feedback
  await expect(page.locator('text=சரியான விடை!')).toBeVisible();

  // Take screenshot of correct answer state
  await page.screenshot({ path: 'C:/Users/santh/.gemini/antigravity-ide/brain/2ca22897-c1dc-45ab-b7c9-0a24f0d05a57/q032_success_localhost.png' });
});
