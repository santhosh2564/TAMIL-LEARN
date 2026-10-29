import { test, expect } from '@playwright/test';

test.describe('Phase E: English Learning Progress & Mastery Tracking E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => localStorage.clear());
  });

  test('Curriculum Overview displays 4 separate metrics, deterministic recommendation, and module cards', async ({
    page,
  }) => {
    await page.goto('http://localhost:5173/classes/3/subjects/english');
    await page.waitForLoadState('networkidle');

    // Overview Header Stats
    await expect(page.getByText('Words Learned')).toBeVisible();
    await expect(page.getByText('0 / 958').first()).toBeVisible();

    await expect(page.getByText('Words Mastered')).toBeVisible();
    await expect(page.getByText('Reviews Completed')).toBeVisible();
    await expect(page.getByText('0 / 280')).toBeVisible();

    await expect(page.getByText('Modules Completed')).toBeVisible();
    await expect(page.getByText('0 / 8')).toBeVisible();

    // Recommended session CTA: First uncompleted day in curriculum order
    const ctaButton = page.getByRole('button', { name: /Start Learning: Module 1 · Day 1/i });
    await expect(ctaButton).toBeVisible();

    // Module cards progress bar
    const m1Card = page.getByLabel(/Module 1:/i);
    await expect(m1Card).toBeVisible();
    await expect(m1Card.getByText('0 / 5 Days')).toBeVisible();
    await expect(m1Card.getByText('0%')).toBeVisible();
  });

  test('Storage isolation: Answering an English activity writes strictly to English key and never mutates Tamil', async ({
    page,
  }) => {
    // Seed Tamil progress first
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => {
      localStorage.setItem(
        'sa.learning.progress.v1',
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          activities: {
            T_ACT_01: {
              activityId: 'T_ACT_01',
              category: 'spelling-choice',
              completed: true,
              correct: true,
              attempts: 1,
              firstAttemptCorrect: true,
              finalCorrect: true,
            },
          },
        })
      );
    });

    const initialTamilStorage = await page.evaluate(() =>
      localStorage.getItem('sa.learning.progress.v1')
    );
    expect(initialTamilStorage).toContain('T_ACT_01');

    // Navigate to Module 1 Day 1 practice session with spelling-choice category for deterministic button matching
    await page.goto('http://localhost:5173/session/3/english/play?category=spelling-choice&module=1&day=1&size=1');
    await page.waitForLoadState('networkidle');

interface RawActivity {
  id: string;
  day?: number;
  category?: string;
  variant?: string;
  targetWord?: string;
  correctAnswer?: string;
  options?: Array<{ id: string; label: string }>;
}

    // Find the correct answer dynamically for whatever shuffled activity was presented
    const correctAnswer = await page.evaluate(async () => {
      const res = await fetch('/src/content/class-3/english/module-1/activities.json');
      const allActs: RawActivity[] = await res.json();
      const buttonLabels = Array.from(document.querySelectorAll('button[aria-pressed]')).map(
        (b) => b.textContent?.trim() || ''
      );

      for (const act of allActs) {
        if (typeof act.correctAnswer === 'string') {
          if (act.options && act.options.length > 0 && buttonLabels.length > 0) {
            const isMatch = act.options.every((opt) => buttonLabels.includes(opt.label));
            if (isMatch) return act.correctAnswer;
          }
          if (act.targetWord && document.body.innerText.includes(act.targetWord) && act.variant === 'word-entry') {
            return act.correctAnswer;
          }
        }
      }
      return 'ask';
    });

    const wordInput = page.locator('input[aria-label="Word answer input"]');
    if (await wordInput.isVisible()) {
      await wordInput.fill(correctAnswer);
    } else {
      const optBtn = page.getByRole('button', { name: correctAnswer, exact: true });
      if (await optBtn.isVisible()) {
        await optBtn.click();
      } else {
        await page.locator('button[aria-pressed]').first().click();
      }
    }

    const checkBtn = page.getByRole('button', { name: /Check Answer/i });
    await expect(checkBtn).toBeEnabled();
    await checkBtn.click();

    // Verify localStorage:
    // 1. sa.learning.progress.english.v1 must be created and populated
    const englishStorageRaw = await page.evaluate(() =>
      localStorage.getItem('sa.learning.progress.english.v1')
    );
    expect(englishStorageRaw).not.toBeNull();
    const parsedEnglish = JSON.parse(englishStorageRaw!);
    const englishKeys = Object.keys(parsedEnglish.activities);
    expect(englishKeys.length).toBeGreaterThanOrEqual(1);
    const firstActId = englishKeys[0];
    expect(firstActId).toMatch(/^ENG-M1-/);
    expect(parsedEnglish.activities[firstActId].completed).toBe(true);

    // 2. sa.learning.progress.v1 must be completely UNTOUCHED
    const currentTamilStorage = await page.evaluate(() =>
      localStorage.getItem('sa.learning.progress.v1')
    );
    expect(currentTamilStorage).toBe(initialTamilStorage);
    const parsedTamil = JSON.parse(currentTamilStorage!);
    expect(parsedTamil.activities[firstActId]).toBeUndefined();
    expect(parsedTamil.activities['T_ACT_01']).toBeDefined();
  });

  test('Module Detail Page displays partial day progress bar and updated button labels', async ({
    page,
  }) => {
    // Seed 12 completed activities for Module 1 Day 1 (50% progress) using actual Day 1 activity IDs
    await page.goto('http://localhost:5173/');
    await page.evaluate(async () => {
      // Vite dev server serves src files
      const res = await fetch('/src/content/class-3/english/module-1/activities.json');
      const allActs: Array<{ id: string; day: number; category: string }> = await res.json();
      const d1Acts = allActs.filter((a) => a.day === 1);

      const activities: Record<string, unknown> = {};
      for (let i = 0; i < 12; i++) {
        const id = d1Acts[i].id;
        activities[id] = {
          activityId: id,
          category: d1Acts[i].category,
          completed: true,
          correct: true,
          attempts: 1,
          firstAttemptCorrect: true,
          finalCorrect: true,
        };
      }
      localStorage.setItem(
        'sa.learning.progress.english.v1',
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          activities,
        })
      );
    });

    await page.goto('http://localhost:5173/classes/3/subjects/english/modules/1');
    await page.waitForLoadState('networkidle');

    // Day 1 Card should display partial progress and "Continue" button
    const day1Card = page.getByLabel(/Day 1:/i);
    await expect(day1Card).toBeVisible();
    await expect(day1Card.getByText('12 / 24 done')).toBeVisible();
    await expect(day1Card.getByText('50%')).toBeVisible();
    await expect(day1Card.getByText('In Progress')).toBeVisible();
    await expect(day1Card.getByRole('button', { name: /Continue/i })).toBeVisible();

    // Day 2 Card should remain unstarted
    const day2Card = page.getByLabel(/Day 2:/i);
    await expect(day2Card).toBeVisible();
    await expect(day2Card.getByText('0 / 24 done')).toBeVisible();
    await expect(day2Card.getByText('0%')).toBeVisible();
    await expect(day2Card.getByRole('button', { name: /Start/i })).toBeVisible();
  });

  test('Full-Day Completion Transition: Fresh 0% -> Complete Day 1 (24/24) -> Module 1 changes to exactly 20% -> Persistence verified', async ({
    page,
  }) => {
    // 1. Fresh state check on Learning Area: Module 1 is at 0% and 0 / 5 Days
    await page.goto('http://localhost:5173/classes/3/subjects/english');
    await page.waitForLoadState('networkidle');

    const m1Card = page.getByLabel(/Module 1:/i);
    await expect(m1Card).toBeVisible();
    await expect(m1Card.getByText('0 / 5 Days')).toBeVisible();
    await expect(m1Card.getByText('0%')).toBeVisible();

    // 2. Fresh state check on Module 1 Detail: Day 1 is at 0 / 24 done, 0%, and Start
    await page.goto('http://localhost:5173/classes/3/subjects/english/modules/1');
    await page.waitForLoadState('networkidle');

    const day1Card = page.getByLabel(/Day 1:/i);
    await expect(day1Card).toBeVisible();
    await expect(day1Card.getByText('0 / 24 done')).toBeVisible();
    await expect(day1Card.getByText('0%')).toBeVisible();
    await expect(day1Card.getByRole('button', { name: /Start/i })).toBeVisible();

    // 3. Complete every activity in Module 1 Day 1 (all 24 activities)
    await page.evaluate(async () => {
      interface RawAct {
        id: string;
        category?: string;
        day?: number;
      }
      interface StoredActProgress {
        activityId: string;
        category?: string;
        completed: boolean;
        correct: boolean;
        attempts: number;
        firstAttemptCorrect: boolean;
        finalCorrect: boolean;
        lastCompletedAt: string;
        lastAttemptedAt: string;
      }
      const res = await fetch('/src/content/class-3/english/module-1/activities.json');
      const allActs = (await res.json()) as RawAct[];
      const d1Acts = allActs.filter((a) => a.day === 1);

      const activities: Record<string, StoredActProgress> = {};
      for (const act of d1Acts) {
        activities[act.id] = {
          activityId: act.id,
          category: act.category,
          completed: true,
          correct: true,
          attempts: 1,
          firstAttemptCorrect: true,
          finalCorrect: true,
          lastCompletedAt: new Date().toISOString(),
          lastAttemptedAt: new Date().toISOString(),
        };
      }
      localStorage.setItem(
        'sa.learning.progress.english.v1',
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          activities,
        })
      );
    });

    // 4. Reload Module 1 Detail and verify Day 1 shows completed with checkmark state
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(day1Card.getByText('24 / 24 done')).toBeVisible();
    await expect(day1Card.getByText('100%')).toBeVisible();
    await expect(day1Card.getByText('Completed')).toBeVisible();
    await expect(day1Card.getByRole('button', { name: /Practice Again/i })).toBeVisible();

    // 5. Navigate to English Learning Area and verify Module 1 changes to exactly 20% (1 / 5 Days)
    await page.goto('http://localhost:5173/classes/3/subjects/english');
    await page.waitForLoadState('networkidle');

    await expect(m1Card.getByText('1 / 5 Days')).toBeVisible();
    await expect(m1Card.getByText('20%')).toBeVisible();

    // 6. Return to Module 1 Detail and verify Day 1 remains completed
    await m1Card.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*\/classes\/3\/subjects\/english\/modules\/1/);

    const reloadedDay1 = page.getByLabel(/Day 1:/i);
    await expect(reloadedDay1.getByText('24 / 24 done')).toBeVisible();
    await expect(reloadedDay1.getByText('100%')).toBeVisible();
    await expect(reloadedDay1.getByText('Completed')).toBeVisible();

    // 7. Return to Learning Area and verify Module 1 remains at 20%
    await page.goto('http://localhost:5173/classes/3/subjects/english');
    await page.waitForLoadState('networkidle');
    await expect(m1Card.getByText('1 / 5 Days')).toBeVisible();
    await expect(m1Card.getByText('20%')).toBeVisible();
  });

  test('Retry accuracy distinction: Attempt 1 wrong -> Retry -> Attempt 2 correct stores firstAttemptCorrect=false, finalCorrect=true, attempts=2', async ({
    page,
  }) => {
    // 1. Start a 1-activity session with spelling-choice category
    await page.goto('http://localhost:5173/session/3/english/play?category=spelling-choice&module=1&day=1&size=1');
    await page.waitForLoadState('networkidle');

    // Dynamically resolve target answer and a deliberately wrong answer
    const activityInfo = await page.evaluate(async () => {
      interface ActOption {
        label: string;
      }
      interface ActItem {
        correctAnswer?: string;
        options?: ActOption[];
        targetWord?: string;
        variant?: string;
      }
      const res = await fetch('/src/content/class-3/english/module-1/activities.json');
      const allActs = (await res.json()) as ActItem[];
      const buttonLabels = Array.from(document.querySelectorAll('button[aria-pressed]')).map(
        (b) => b.textContent?.trim() || ''
      );

      for (const act of allActs) {
        if (typeof act.correctAnswer === 'string') {
          if (act.options && act.options.length > 0 && buttonLabels.length > 0) {
            const isMatch = act.options.every((opt) => buttonLabels.includes(opt.label));
            if (isMatch) {
              const wrongOpt = act.options.find((o) => o.label !== act.correctAnswer)?.label;
              return { correctAnswer: act.correctAnswer, wrongAnswer: wrongOpt || 'wrong', isSelect: true };
            }
          }
          if (act.targetWord && document.body.innerText.includes(act.targetWord) && act.variant === 'word-entry') {
            return { correctAnswer: act.correctAnswer, wrongAnswer: 'deliberatelywrongxyz', isSelect: false };
          }
        }
      }
      return { correctAnswer: 'ask', wrongAnswer: 'wrongxyz', isSelect: true };
    });

    const wordInput = page.locator('input[aria-label="Word answer input"]');

    // 2. Perform intentional wrong attempt first
    if (await wordInput.isVisible()) {
      await wordInput.fill(activityInfo.wrongAnswer);
    } else {
      const wrongBtn = page.getByRole('button', { name: activityInfo.wrongAnswer, exact: true });
      if (await wrongBtn.isVisible()) {
        await wrongBtn.click();
      } else {
        await page.locator('button[aria-pressed]').last().click();
      }
    }

    const checkBtn = page.getByRole('button', { name: /Check Answer/i });
    await expect(checkBtn).toBeEnabled();
    await checkBtn.click();

    // 3. Verify error feedback and Try Again button appears
    const tryAgainBtn = page.getByRole('button', { name: /Try Again/i });
    await expect(tryAgainBtn).toBeVisible();

    // Confirm that after wrong attempt, progress has NOT been marked completed yet
    const midStorage = await page.evaluate(() => localStorage.getItem('sa.learning.progress.english.v1'));
    if (midStorage) {
      const parsed = JSON.parse(midStorage);
      const keys = Object.keys(parsed.activities || {});
      for (const k of keys) {
        expect(parsed.activities[k].completed).toBeFalsy();
      }
    }

    // 4. Click Retry
    await tryAgainBtn.click();

    // 5. Submit the correct answer on second attempt
    if (await wordInput.isVisible()) {
      await wordInput.fill(activityInfo.correctAnswer);
    } else {
      const correctBtn = page.getByRole('button', { name: activityInfo.correctAnswer, exact: true });
      await correctBtn.click();
    }

    await expect(checkBtn).toBeEnabled();
    await checkBtn.click();

    // 6. Verify success feedback and Continue button
    const continueBtn = page.getByRole('button', { name: /Continue/i });
    await expect(continueBtn).toBeVisible();

    // 7. Verify stored progress model maintains strict distinction:
    // firstAttemptCorrect: false, finalCorrect: true, completed: true, attempts: 2
    const finalStorageRaw = await page.evaluate(() =>
      localStorage.getItem('sa.learning.progress.english.v1')
    );
    expect(finalStorageRaw).not.toBeNull();
    const finalParsed = JSON.parse(finalStorageRaw!);
    const keys = Object.keys(finalParsed.activities);
    expect(keys.length).toBe(1);

    const record = finalParsed.activities[keys[0]];
    expect(record.completed).toBe(true);
    expect(record.attempts).toBe(2);
    expect(record.firstAttemptCorrect).toBe(false); // First attempt was wrong!
    expect(record.finalCorrect).toBe(true); // Final answer is correct!

    // 8. Advance to results page and verify context-aware actions
    await continueBtn.click();
    await expect(page).toHaveURL(/.*\/session\/results/);
    await expect(page.getByText('Activities')).toBeVisible();
    await expect(page.getByText('Accuracy')).toBeVisible();
    await expect(page.getByRole('button', { name: /Practice Again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back to Module/i })).toBeVisible();
  });

  test('Mobile Responsive QA (375x667) - No horizontal overflow on English Progress UI', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // English Learning Area on mobile
    await page.goto('http://localhost:5173/classes/3/subjects/english');
    await page.waitForLoadState('networkidle');

    const scrollWidthArea = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidthArea = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidthArea).toBeLessThanOrEqual(clientWidthArea + 1);

    // Module detail page on mobile
    await page.goto('http://localhost:5173/classes/3/subjects/english/modules/1');
    await page.waitForLoadState('networkidle');

    const scrollWidthMod = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidthMod = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidthMod).toBeLessThanOrEqual(clientWidthMod + 1);
  });
});

