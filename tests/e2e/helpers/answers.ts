import fs from 'fs';
import path from 'path';
import { Page, expect } from '@playwright/test';

export const correctAnswers = new Map<string, string>();
for (let m = 1; m <= 8; m++) {
  const file = path.resolve(process.cwd(), `src/content/class-3/tamil/module-${m}/activities.json`);
  if (fs.existsSync(file)) {
    for (const a of JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ id: string; correctAnswer: string }>) {
      correctAnswers.set(a.id, a.correctAnswer);
    }
  }
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function answerTamilQuestion(page: Page, activityId: string, isCorrect = true) {
  const ans = correctAnswers.get(activityId);
  const opts = page.locator('button[lang="ta"]');
  await opts.first().waitFor({ timeout: 10000 });
  const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
  const retryBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });

  if (ans) {
    const correctBtn = page
      .locator('button[lang="ta"]')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(ans)}\\s*$`) })
      .first();

    if (isCorrect) {
      if (await correctBtn.isVisible().catch(() => false)) {
        await correctBtn.click();
      } else {
        await opts.first().click();
      }
      await checkBtn.click();
      await expect(page.locator('text=சரியான விடை!')).toBeVisible({ timeout: 5000 });
    } else {
      // Pick a button that is NOT the correct one
      const count = await opts.count();
      for (let i = 0; i < count; i++) {
        const text = (await opts.nth(i).innerText()).trim();
        if (text !== ans) {
          await opts.nth(i).click();
          break;
        }
      }
      await checkBtn.click();
      await expect(page.locator('text=தவறான விடை')).toBeVisible({ timeout: 5000 });
    }
  } else {
    // Fallback if not in map
    await opts.first().click();
    await checkBtn.click();
  }
}

