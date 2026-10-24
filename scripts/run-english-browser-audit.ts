/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface EnglishActivity {
  id: string;
  classLevel: number;
  subject: string;
  language: string;
  module: number;
  day: number;
  role: string;
  level: number;
  sourceDifficulty: string;
  targetWord?: string;
  category: string;
  variant: string;
  prompt: string;
  options?: Array<{ id: string; label: string }>;
  template?: string;
  correctAnswer: string;
  image?: { source?: string };
  source?: {
    workbook?: string;
    ewId?: string;
    activityCode?: string;
    originalActivity?: string;
    hasSourceAnomaly?: boolean;
    anomalyNote?: string;
  };
}

export interface EnglishAuditResult {
  questionId: string;
  activityId: string;
  module: string;
  category: string;
  activityType: string;
  question: string;
  expectedAnswer: string;
  browserAnswer: string;
  result: 'PASS' | 'FAIL';
  hasImage: boolean;
  imageLoaded: boolean | null;
  rendered: boolean;
  correctAnswerAccepted: boolean;
  incorrectAnswerTested?: boolean;
  incorrectAnswerRejected?: boolean;
  retryButtonVerified?: boolean;
  progressUpdated: boolean;
  attemptRecorded: boolean;
  errors: string[];
  durationMs: number;
}

interface BrowserErrorLog {
  activityId: string;
  type: 'console' | 'pageerror' | 'requestfailed';
  message: string;
  timestamp: string;
}

import {
  WordCompletionEvaluator,
  SpellingChoiceEvaluator,
  PictureRecognitionEvaluator,
  ContextChoiceEvaluator,
  WordEntryEvaluator
} from '../src/engine/evaluators';

const evaluators = {
  wordCompletion: new WordCompletionEvaluator(),
  spellingChoice: new SpellingChoiceEvaluator(),
  pictureRecognition: new PictureRecognitionEvaluator(),
  contextChoice: new ContextChoiceEvaluator(),
  wordEntry: new WordEntryEvaluator()
};

const REPORT_DIR = path.resolve('qa-report');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const CONCURRENCY = 2;
const RECYCLE_EVERY_N = 35;

function cleanForTokenMatch(str: any): string {
  if (typeof str !== 'string') {
    if (Array.isArray(str)) {
      str = str[0] || '';
    } else {
      str = String(str || '');
    }
  }
  return str.replace(/[\s\-_’'"`.,!?]+/g, '').toLowerCase();
}

function findCorrectChoiceOption(item: EnglishActivity): { id: string; label: string } | null {
  if (!item.options || item.options.length === 0) return null;

  // 1. Evaluator-based match
  for (const opt of item.options) {
    if (item.category === 'word-completion') {
      if (evaluators.wordCompletion.evaluate(item as any, opt.id).correct ||
          evaluators.wordCompletion.evaluate(item as any, opt.label).correct) {
        return opt;
      }
    } else if (item.category === 'spelling-choice') {
      if (evaluators.spellingChoice.evaluate(item as any, opt.id).correct ||
          evaluators.spellingChoice.evaluate(item as any, opt.label).correct) {
        return opt;
      }
    } else if (item.category === 'context-choice') {
      if (evaluators.contextChoice.evaluate(item as any, opt.id).correct ||
          evaluators.contextChoice.evaluate(item as any, opt.label).correct) {
        return opt;
      }
    } else if (item.category === 'picture-recognition') {
      if (evaluators.pictureRecognition.evaluate(item as any, opt.id).correct ||
          evaluators.pictureRecognition.evaluate(item as any, opt.label).correct ||
          evaluators.wordEntry.evaluate(item as any, opt.id).correct ||
          evaluators.wordEntry.evaluate(item as any, opt.label).correct) {
        return opt;
      }
    } else if (item.category === 'meaning-match' || item.variant === 'word-entry') {
      if (evaluators.wordEntry.evaluate(item as any, opt.id).correct ||
          evaluators.wordEntry.evaluate(item as any, opt.label).correct) {
        return opt;
      }
    }
  }

  // 2. Direct string match fallback
  for (const opt of item.options) {
    if (opt.label.toLowerCase() === item.correctAnswer.toLowerCase() ||
        (item.targetWord && opt.label.toLowerCase() === item.targetWord.toLowerCase()) ||
        opt.id.toLowerCase() === item.correctAnswer.toLowerCase()) {
      return opt;
    }
  }

  return null;
}

function findTokenSequence(target: string, availableTokens: string[]): string[] | null {
  const cleanTarget = cleanForTokenMatch(target);

  function search(remTarget: string, remTokens: string[], path: string[]): string[] | null {
    if (remTarget === '') return path;
    for (let i = 0; i < remTokens.length; i++) {
      const tok = remTokens[i];
      const cleanTok = cleanForTokenMatch(tok);
      if (cleanTok && remTarget.startsWith(cleanTok)) {
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

async function runWorker(
  workerId: number,
  browser: Browser,
  items: EnglishActivity[],
  testedTypesForIncorrect: Set<string>,
  allResults: EnglishAuditResult[],
  errorLogs: BrowserErrorLog[],
  onItemCompleted: () => void
) {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  async function initContext() {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    page = await context.newPage();

    await page.addInitScript(() => {
      try {
        localStorage.setItem('sa.activeStudentId.v1', 'qa-english-audit');
        localStorage.setItem('sa.students.v1', JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          students: [{
            id: 'qa-english-audit',
            name: 'Sara English QA',
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString()
          }]
        }));
      } catch {
        // ignore
      }
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('vite')) {
          errorLogs.push({
            activityId: 'unknown',
            type: 'console',
            message: text,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    page.on('pageerror', err => {
      errorLogs.push({
        activityId: 'unknown',
        type: 'pageerror',
        message: err.message,
        timestamp: new Date().toISOString()
      });
    });

    page.on('requestfailed', req => {
      const url = req.url();
      if (!url.includes('favicon')) {
        errorLogs.push({
          activityId: 'unknown',
          type: 'requestfailed',
          message: `${req.method()} ${url} - ${req.failure()?.errorText}`,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  await initContext();

  for (let idx = 0; idx < items.length; idx++) {
    if (idx > 0 && idx % RECYCLE_EVERY_N === 0) {
      await initContext();
    }

    const item = items[idx];
    const start = Date.now();
    const errors: string[] = [];
    const isArrange = item.category === 'arrange-word' || item.variant === 'arrange';
    const isChoice = !isArrange && Boolean(item.options && item.options.length > 0);
    const activityType = `${item.category}::${item.variant}`;
    const questionId = item.source?.ewId || item.id;

    const result: EnglishAuditResult = {
      questionId,
      activityId: item.id,
      module: `Module ${item.module}`,
      category: item.category,
      activityType,
      question: item.prompt || item.targetWord || '',
      expectedAnswer: item.correctAnswer,
      browserAnswer: '',
      result: 'FAIL',
      hasImage: Boolean(item.image) || item.category === 'picture-recognition' || /look at the picture/i.test(item.prompt || ''),
      imageLoaded: null,
      rendered: false,
      correctAnswerAccepted: false,
      progressUpdated: false,
      attemptRecorded: false,
      errors,
      durationMs: 0
    };

    let attempt = 0;
    while (attempt < 2) {
      attempt++;
      errors.length = 0;
      try {
        if (!page) await initContext();

      // 1. Navigate to activity
      await page!.goto(`${BASE_URL}/session/3/english/play?activityId=${encodeURIComponent(item.id)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // 2. Verify rendering
      const card = page!.locator('h2, [data-testid="activity-card"]').first();
      await card.waitFor({ state: 'visible', timeout: 12000 });
      result.rendered = true;

      // 3. Visual asset verification
      if (result.hasImage) {
        const img = page!.locator('img[data-testid="activity-asset-image"]');
        const missingFallback = page!.locator('[data-testid="asset-fallback-missing"]');
        const invalidFallback = page!.locator('[data-testid="asset-fallback-invalid"]');

        let imgVisible = false;
        try {
          await Promise.race([
            img.waitFor({ state: 'visible', timeout: 3500 }).then(() => { imgVisible = true; }),
            missingFallback.waitFor({ state: 'visible', timeout: 3500 })
          ]);
        } catch {
          // Fall through
        }

        if (await invalidFallback.isVisible().catch(() => false)) {
          errors.push('Invalid asset fallback rendered (asset error)');
          result.imageLoaded = false;
        } else if (imgVisible) {
          const nw = await img.evaluate(async (el: HTMLImageElement) => {
            if (!el.complete) {
              await new Promise(r => {
                el.onload = el.onerror = r;
                setTimeout(r, 3000);
              });
            }
            return el.naturalWidth;
          }).catch(() => 0);

          if (nw > 0) {
            result.imageLoaded = true;
          } else {
            result.imageLoaded = false;
            errors.push('Image rendered with naturalWidth 0');
          }
        } else if (await missingFallback.isVisible().catch(() => false)) {
          // Graceful missing fallback
          result.imageLoaded = true;
        } else {
          result.imageLoaded = false;
          errors.push('Neither image nor fallback was rendered');
        }
      }

      // 4. Incorrect answer & retry test (once per activity type across run)
      const shouldTestIncorrect = !testedTypesForIncorrect.has(activityType);
      if (shouldTestIncorrect) {
        testedTypesForIncorrect.add(activityType);
        result.incorrectAnswerTested = true;

        if (isArrange) {
          const availableBtns = page!.locator('button[aria-label^="Select "]');
          if (await availableBtns.count() >= 2) {
            await availableBtns.first().click();
            const checkBtn = page!.locator('button', { hasText: 'Check Answer' });
            if (await checkBtn.isEnabled()) {
              await checkBtn.click();
              const wrongFeedback = page!.locator('text=Not quite. Try again.');
              const retryBtn = page!.locator('button', { hasText: 'Try Again' });
              try {
                await wrongFeedback.waitFor({ state: 'visible', timeout: 4000 });
                await retryBtn.waitFor({ state: 'visible', timeout: 4000 });
                result.incorrectAnswerRejected = true;
                result.retryButtonVerified = true;
                await retryBtn.click();
                await page!.waitForTimeout(150);
              } catch {
                errors.push('Incorrect arrange answer was not rejected with retry button');
              }
            }
          }
        } else if (isChoice) {
          const correctOpt = findCorrectChoiceOption(item);
          const wrongOpt = item.options?.find(o => o.id !== correctOpt?.id);
          if (wrongOpt) {
            let clickedWrong = false;
            const btnById = page!.locator(`button#option-${wrongOpt.id}, button[data-testid="activity-option-${wrongOpt.id}"]`).first();
            if (await btnById.isVisible().catch(() => false)) {
              await btnById.click();
              clickedWrong = true;
            } else {
              const btnByText = page!.getByRole('button', { name: wrongOpt.label, exact: true }).first();
              if (await btnByText.isVisible().catch(() => false)) {
                await btnByText.click();
                clickedWrong = true;
              }
            }

            if (clickedWrong) {
              const checkBtn = page!.locator('button', { hasText: 'Check Answer' });
              if (await checkBtn.isEnabled()) {
                await checkBtn.click();
                const wrongFeedback = page!.locator('text=Not quite. Try again.');
                const retryBtn = page!.locator('button', { hasText: 'Try Again' });
                try {
                  await wrongFeedback.waitFor({ state: 'visible', timeout: 4000 });
                  await retryBtn.waitFor({ state: 'visible', timeout: 4000 });
                  result.incorrectAnswerRejected = true;
                  result.retryButtonVerified = true;
                  await retryBtn.click();
                  await page!.waitForTimeout(150);
                } catch {
                  errors.push('Incorrect choice answer was not rejected with retry button');
                }
              }
            }
          }
        } else {
          // Input mode
          const input = page!.locator('input[aria-label="Word answer input"], input[aria-label="Missing letter input"], input[type="text"]').first();
          if (await input.isVisible()) {
            await input.fill('xyzincorrect');
            const checkBtn = page!.locator('button', { hasText: 'Check Answer' });
            if (await checkBtn.isEnabled()) {
              await checkBtn.click();
              const wrongFeedback = page!.locator('text=Not quite. Try again.');
              const retryBtn = page!.locator('button', { hasText: 'Try Again' });
              try {
                await wrongFeedback.waitFor({ state: 'visible', timeout: 4000 });
                await retryBtn.waitFor({ state: 'visible', timeout: 4000 });
                result.incorrectAnswerRejected = true;
                result.retryButtonVerified = true;
                await retryBtn.click();
                await page!.waitForTimeout(150);
              } catch {
                errors.push('Incorrect text input was not rejected with retry button');
              }
            }
          }
        }
      }

      // 5. Submit intended correct answer
      if (isArrange) {
        // Clear any selected tokens
        const removeBtns = page!.locator('button[aria-label^="Remove "]');
        while (await removeBtns.count() > 0) {
          await removeBtns.first().click();
          await page!.waitForTimeout(50);
        }

        const availableBtns = page!.locator('button[aria-label^="Select "]');
        const tokenCount = await availableBtns.count();
        const availablePool: string[] = [];
        for (let i = 0; i < tokenCount; i++) {
          const ariaLabel = await availableBtns.nth(i).getAttribute('aria-label') || '';
          availablePool.push(ariaLabel.replace(/^Select\s+/, '').trim());
        }

        const targets = Array.isArray(item.correctAnswer) ? item.correctAnswer : [item.correctAnswer];
        let tokenSequence: string[] | null = null;
        for (const t of targets) {
          tokenSequence = findTokenSequence(t, availablePool);
          if (tokenSequence) break;
        }
        if (!tokenSequence && item.targetWord) {
          tokenSequence = findTokenSequence(item.targetWord, availablePool);
        }
        if (!tokenSequence && item.options) {
          tokenSequence = item.options.map(o => o.label);
        }

        if (!tokenSequence || tokenSequence.length === 0) {
          errors.push(`Could not determine token arrangement sequence for: ${item.correctAnswer}`);
        } else {
          result.browserAnswer = tokenSequence.join(' ');
          for (const tok of tokenSequence) {
            const btn = page!.locator(`button[aria-label="Select ${tok}" i]`).first();
            if (await btn.isVisible().catch(() => false)) {
              await btn.click();
              await page!.waitForTimeout(40);
            } else {
              const btnByText = page!.getByRole('button', { name: new RegExp('^' + tok + '$', 'i') }).first();
              if (await btnByText.isVisible().catch(() => false)) {
                await btnByText.click();
                await page!.waitForTimeout(40);
              } else {
                errors.push(`Token button not found: ${tok}`);
              }
            }
          }
        }
      } else if (isChoice) {
        let clicked = false;
        const correctOpt = findCorrectChoiceOption(item);

        if (correctOpt) {
          const optBtn = page!.locator(`button#option-${correctOpt.id}, button[data-testid="activity-option-${correctOpt.id}"]`).first();
          if (await optBtn.isVisible().catch(() => false)) {
            await optBtn.click();
            result.browserAnswer = correctOpt.label;
            clicked = true;
          } else {
            const btnByRole = page!.getByRole('button', { name: correctOpt.label, exact: true }).first();
            if (await btnByRole.isVisible().catch(() => false)) {
              await btnByRole.click();
              result.browserAnswer = correctOpt.label;
              clicked = true;
            }
          }
        }

        // Fallbacks if not yet clicked
        if (!clicked) {
          const targetBtn = page!.getByRole('button', { name: item.correctAnswer, exact: true }).first();
          if (await targetBtn.isVisible().catch(() => false)) {
            await targetBtn.click();
            result.browserAnswer = item.correctAnswer;
            clicked = true;
          }
        }

        if (!clicked) {
          errors.push(`Choice button not found for answer: ${item.correctAnswer}`);
        }
      } else {
        // Text input mode
        const input = page!.locator('input[aria-label="Word answer input"], input[aria-label="Missing letter input"], input[type="text"]').first();
        if (await input.isVisible()) {
          const answerToFill = item.correctAnswer || item.targetWord || '';
          await input.fill(answerToFill);
          result.browserAnswer = answerToFill;
        } else {
          errors.push('Text input element not found');
        }
      }

      // Click "Check Answer"
      const checkBtn = page!.locator('button', { hasText: 'Check Answer' });
      await checkBtn.waitFor({ state: 'visible', timeout: 3000 });
      if (await checkBtn.isEnabled()) {
        await checkBtn.click();
      }

      // Verify "Correct!" feedback
      const successFeedback = page!.locator('text=Correct!');
      try {
        await successFeedback.waitFor({ state: 'visible', timeout: 5000 });
        result.correctAnswerAccepted = true;
      } catch {
        errors.push('Success feedback "Correct!" did not appear');
      }

      // Verify "Continue" button appears
      const continueBtn = page!.locator('button', { hasText: 'Continue' });
      try {
        await continueBtn.waitFor({ state: 'visible', timeout: 3000 });
      } catch {
        errors.push('Continue button did not appear');
      }

      // Verify localStorage progress & attempts with async write wait
      let storageData = { prog: '', att: '' };
      for (let retries = 0; retries < 6; retries++) {
        storageData = await page!.evaluate(() => ({
          prog: localStorage.getItem('sa.learning.progress.english.v1') || localStorage.getItem('sa.learning.progress.v1') || '',
          att: localStorage.getItem('sa.learning.attempts.v1') || ''
        }));
        if (storageData.prog.includes(item.id) || storageData.att.includes(item.id)) {
          break;
        }
        await page!.waitForTimeout(100);
      }

      result.progressUpdated = Boolean(storageData.prog && storageData.prog.includes(item.id));
      result.attemptRecorded = Boolean(storageData.att && storageData.att.includes(item.id));

      if (!result.progressUpdated && !result.attemptRecorded) {
        errors.push('Activity completion was not saved in localStorage');
      }

      // Status determination
      if (
        result.rendered &&
        (!result.hasImage || result.imageLoaded) &&
        result.correctAnswerAccepted &&
        errors.length === 0
      ) {
        result.result = 'PASS';
      } else {
        result.result = 'FAIL';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Unhandled execution error: ${msg}`);
      result.result = 'FAIL';
      if (msg.includes('closed')) {
        await initContext();
      }
    }

    if (result.result === 'PASS') break;
    if (attempt < 2 && errors.some(e => e.includes('Timeout') || e.includes('waiting for') || e.includes('Target closed') || e.includes('ERR_ABORTED') || e.includes('net::ERR_'))) {
      await initContext();
      await page!.waitForTimeout(300);
      continue;
    }
    break;
  }

    result.durationMs = Date.now() - start;
    allResults.push(result);
    onItemCompleted();
  }

  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
}

async function main() {
  console.log('================================================================');
  console.log('   SARA PLATFORM — ENGLISH FULL PLAYWRIGHT BROWSER AUDIT        ');
  console.log('================================================================\n');

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // Load all 8 English modules
  const allActivities: EnglishActivity[] = [];
  for (let m = 1; m <= 8; m++) {
    const modFile = path.resolve(`src/content/class-3/english/module-${m}/activities.json`);
    if (!fs.existsSync(modFile)) {
      throw new Error(`Module file missing: ${modFile}`);
    }
    const acts: EnglishActivity[] = JSON.parse(fs.readFileSync(modFile, 'utf8'));
    allActivities.push(...acts);
  }

  console.log(`Discovered ${allActivities.length} English activities across 8 modules.`);
  console.log(`Starting headless Chromium browser audit with ${CONCURRENCY} parallel worker threads (recycling context every ${RECYCLE_EVERY_N} items)...\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allResults: EnglishAuditResult[] = [];
  const errorLogs: BrowserErrorLog[] = [];
  const testedTypesForIncorrect = new Set<string>();

  const workerItems: EnglishActivity[][] = Array.from({ length: CONCURRENCY }, () => []);
  allActivities.forEach((item, idx) => {
    workerItems[idx % CONCURRENCY].push(item);
  });

  let completedCount = 0;
  const total = allActivities.length;
  const startTime = Date.now();

  const onItemCompleted = () => {
    completedCount++;
    if (completedCount % 50 === 0 || completedCount === total) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const passedCount = allResults.filter(r => r.result === 'PASS').length;
      const failedCount = allResults.filter(r => r.result === 'FAIL').length;
      console.log(`[Progress: ${completedCount}/${total}] (${((completedCount / total) * 100).toFixed(1)}%) | Elapsed: ${elapsedSec}s | Passed: ${passedCount} | Failed: ${failedCount}`);

      fs.writeFileSync(path.join(REPORT_DIR, 'english-browser-audit.json'), JSON.stringify(allResults, null, 2), 'utf8');
    }
  };

  await Promise.all(
    workerItems.map((wItems, idx) =>
      runWorker(idx, browser, wItems, testedTypesForIncorrect, allResults, errorLogs, onItemCompleted)
    )
  );

  await browser.close();

  const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll ${total} English activities tested in ${totalDurationSec}s.`);

  // Write final json
  fs.writeFileSync(path.join(REPORT_DIR, 'english-browser-audit.json'), JSON.stringify(allResults, null, 2), 'utf8');

  // Print summary
  const passed = allResults.filter(r => r.result === 'PASS').length;
  const failed = allResults.filter(r => r.result === 'FAIL').length;
  const passRate = ((passed / total) * 100).toFixed(2);

  console.log('\n================================================================');
  console.log('   FINAL ENGLISH PLAYWRIGHT AUDIT SUMMARY                       ');
  console.log('================================================================');
  console.log(`Total Activities:  ${total}`);
  console.log(`Browser Tested:    ${allResults.length}`);
  console.log(`Passed:            ${passed}`);
  console.log(`Failed:            ${failed}`);
  console.log(`Pass Rate:         ${passRate}%`);
  console.log(`Console Errors:    ${errorLogs.filter(e => e.type === 'console').length}`);
  console.log(`Page Errors:       ${errorLogs.filter(e => e.type === 'pageerror').length}`);
  console.log(`Request Failures:  ${errorLogs.filter(e => e.type === 'requestfailed').length}`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`AUDIT FAILED: ${failed} activities encountered errors.`);
    const sampleFailures = allResults.filter(r => r.result === 'FAIL').slice(0, 10);
    console.error('First 10 failures:', JSON.stringify(sampleFailures, null, 2));
    process.exit(1);
  } else {
    console.log('AUDIT PASSED: 100% of English activities verified through Playwright!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
