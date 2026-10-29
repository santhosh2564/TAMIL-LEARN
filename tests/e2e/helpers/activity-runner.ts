import { Page, expect } from '@playwright/test';
import { InventoryItem } from '../../../scripts/generate-authoritative-inventory';

export interface QuestionVerificationResult {
  questionId: string;
  activityId: string;
  module: string;
  activityType: string;
  rendered: boolean;
  imageLoaded: boolean;
  correctAnswerAccepted: boolean;
  incorrectAnswerRejected?: boolean;
  progressUpdated: boolean;
  attemptRecorded: boolean;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  errors: string[];
}

export function findTokenSequence(target: string, availableTokens: string[]): string[] | null {
  const cleanTarget = target.replace(/\s+/g, '');
  function search(remTarget: string, remTokens: string[], path: string[]): string[] | null {
    if (remTarget === '') return path;
    for (let i = 0; i < remTokens.length; i++) {
      const tok = remTokens[i];
      const cleanTok = tok.replace(/\s+/g, '');
      if (remTarget.startsWith(cleanTok)) {
        const nextRem = remTarget.slice(cleanTok.length);
        const nextToks = [...remTokens.slice(0, i), ...remTokens.slice(i + 1)];
        const res = search(nextRem, nextToks, [...path, tok]);
        if (res) return res;
      }
    }
    return null;
  }
  return search(cleanTarget, availableTokens, []);
}

export async function setupStudentContext(page: Page, studentId = 'qa-audit-student', studentName = 'தணிகைவேல்') {
  await page.addInitScript(({ id, name }) => {
    try {
      if (!localStorage.getItem('sa.activeStudentId.v1')) {
        localStorage.setItem('sa.activeStudentId.v1', id);
        localStorage.setItem('sa.students.v1', JSON.stringify({
          version: 1,
          students: [{
            id,
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        }));
      }
    } catch {
      // ignore
    }
  }, { id: studentId, name: studentName });
}

export async function verifyQuestionInBrowser(
  page: Page,
  item: InventoryItem,
  options: { testIncorrectFirst?: boolean } = {}
): Promise<QuestionVerificationResult> {
  const errors: string[] = [];
  const result: QuestionVerificationResult = {
    questionId: item.question_id,
    activityId: item.activity_id,
    module: item.module,
    activityType: item.activity_type,
    rendered: false,
    imageLoaded: false,
    correctAnswerAccepted: false,
    progressUpdated: false,
    attemptRecorded: false,
    status: 'FAIL',
    errors
  };

  try {
    // 1. Navigate to activity
    await page.goto(`/session/3/tamil/play?activityId=${encodeURIComponent(item.activity_id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // 2. Verify activity renders
    // Card or prompt container should be visible
    const promptLocator = page.locator('h2, [data-testid="activity-card"]');
    await expect(promptLocator.first()).toBeVisible({ timeout: 5000 });
    result.rendered = true;

    // 3. Image verification if image is required
    if (item.has_image && item.image) {
      const imgLocator = page.locator('img[data-testid="activity-asset-image"]');
      const isVisible = await imgLocator.isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) {
        const naturalWidth = await imgLocator.evaluate((img: HTMLImageElement) => img.naturalWidth).catch(() => 0);
        if (naturalWidth > 0) {
          result.imageLoaded = true;
        } else {
          errors.push(`Image failed to load (naturalWidth = 0): ${item.image}`);
        }
      } else {
        errors.push(`Image element missing or fallback displayed for: ${item.image}`);
      }
    } else {
      result.imageLoaded = true; // No image required
    }

    const isArrange = item.activity_type.toLowerCase().includes('arrange');

    // 4. Test incorrect answer first if requested
    if (options.testIncorrectFirst) {
      if (isArrange) {
        // Select only 1 token and check if allowed, or pick reversed order
        const availableTokens = page.locator('button[aria-label^="Select "]');
        const tokenCount = await availableTokens.count();
        if (tokenCount >= 2) {
          // Click the last token first to form wrong sequence
          await availableTokens.nth(tokenCount - 1).click();
          await availableTokens.nth(0).click();
          const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
          if (await checkBtn.isEnabled()) {
            await checkBtn.click();
            const wrongFeedback = page.locator('text=தவறான விடை');
            const retryBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
            if (await wrongFeedback.isVisible({ timeout: 3000 }) && await retryBtn.isVisible({ timeout: 3000 })) {
              result.incorrectAnswerRejected = true;
              await retryBtn.click();
            } else {
              errors.push('Incorrect arrange answer was not rejected with retry button');
            }
          }
        }
      } else {
        // Multiple choice: pick an option that is not the correct answer
        const allOptionBtns = page.locator('button[lang="ta"]');
        const count = await allOptionBtns.count();
        let wrongBtnClicked = false;
        for (let i = 0; i < count; i++) {
          const btn = allOptionBtns.nth(i);
          const txt = (await btn.innerText()).trim();
          if (txt !== item.expected_answer && txt !== item.target_word) {
            await btn.click();
            wrongBtnClicked = true;
            break;
          }
        }
        if (wrongBtnClicked) {
          const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
          if (await checkBtn.isEnabled()) {
            await checkBtn.click();
            const wrongFeedback = page.locator('text=தவறான விடை');
            const retryBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
            if (await wrongFeedback.isVisible({ timeout: 3000 }) && await retryBtn.isVisible({ timeout: 3000 })) {
              result.incorrectAnswerRejected = true;
              await retryBtn.click();
            } else {
              errors.push('Incorrect choice answer was not rejected with retry button');
            }
          }
        }
      }
    }

    // 5. Submit correct answer
    if (isArrange) {
      // Clear any already selected tokens by clicking Remove buttons
      const removeBtns = page.locator('button[aria-label^="Remove "]');
      while (await removeBtns.count() > 0) {
        await removeBtns.first().click();
      }

      // Collect available token labels from the pool
      const availableBtns = page.locator('button[aria-label^="Select "]');
      const tokenCount = await availableBtns.count();
      const availablePool: string[] = [];
      for (let i = 0; i < tokenCount; i++) {
        const ariaLabel = await availableBtns.nth(i).getAttribute('aria-label') || '';
        const label = ariaLabel.replace(/^Select\s+/, '').trim();
        availablePool.push(label);
      }

      // Find token sequence that concatenates to expected_answer
      const tokenSequence = findTokenSequence(item.expected_answer, availablePool) 
        || (item.target_word ? findTokenSequence(item.target_word, availablePool) : null)
        || item.units;

      if (!tokenSequence || tokenSequence.length === 0) {
        errors.push(`Could not determine token arrangement sequence for expected answer: ${item.expected_answer}`);
      } else {
        // Click tokens matching tokenSequence in order
        for (const unit of tokenSequence) {
          const availableBtn = page.locator(`button[aria-label="Select ${unit}"]`).first();
          if (await availableBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await availableBtn.click();
          } else {
            const btnByText = page.getByRole('button', { name: unit, exact: true }).first();
            if (await btnByText.isVisible({ timeout: 2000 }).catch(() => false)) {
              await btnByText.click();
            } else {
              errors.push(`Arrange token button not found for unit: ${unit}`);
            }
          }
        }
      }
    } else {
      // Choice or Word Completion
      let correctBtn = page.getByRole('button', { name: item.expected_answer, exact: true });
      let exists = await correctBtn.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (!exists && item.target_word) {
        // Fallback to target word if expected answer was unit but button shows target word or vice versa
        correctBtn = page.getByRole('button', { name: item.target_word, exact: true });
        exists = await correctBtn.isVisible({ timeout: 2000 }).catch(() => false);
      }

      if (!exists) {
        // Check all buttons with lang="ta"
        const allBtns = page.locator('button[lang="ta"]');
        const count = await allBtns.count();
        let found = false;
        for (let i = 0; i < count; i++) {
          const btn = allBtns.nth(i);
          const txt = (await btn.innerText()).trim();
          if (txt === item.expected_answer || txt === item.target_word) {
            await btn.click();
            found = true;
            break;
          }
        }
        if (!found) {
          errors.push(`Correct answer button not found for: ${item.expected_answer} (options: ${item.options.join(', ')})`);
        }
      } else {
        await correctBtn.first().click();
      }
    }

    // Click Check Answer ("விடையைச் சரிபார்")
    const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
    await expect(checkBtn).toBeEnabled({ timeout: 3000 });
    await checkBtn.click();

    // Verify success feedback: "சரியான விடை!"
    const successFeedback = page.locator('text=சரியான விடை!');
    await expect(successFeedback).toBeVisible({ timeout: 5000 });
    result.correctAnswerAccepted = true;

    // Verify Continue button ("தொடர்க") appears
    const continueBtn = page.locator('button', { hasText: 'தொடர்க' });
    await expect(continueBtn).toBeVisible({ timeout: 3000 });

    // Verify localStorage has recorded attempt and progress
    const storageData = await page.evaluate(() => {
      const prog = localStorage.getItem('sa.learning.progress.v2') || localStorage.getItem('sa.learning.progress.v1');
      const att = localStorage.getItem('sa.learning.attempts.v1') || localStorage.getItem('sa.attempts.v1');
      return { prog, att };
    });

    result.attemptRecorded = Boolean(storageData.att && storageData.att.includes(item.activity_id));
    result.progressUpdated = Boolean(storageData.prog && storageData.prog.includes(item.activity_id));

    // If no critical errors, mark PASS
    if (result.rendered && result.imageLoaded && result.correctAnswerAccepted && errors.length === 0) {
      result.status = 'PASS';
    } else {
      result.status = 'FAIL';
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Exception: ${msg}`);
    result.status = 'FAIL';
  }

  return result;
}
