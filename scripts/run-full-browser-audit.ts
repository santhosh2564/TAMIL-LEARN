import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findTokenSequence } from '../tests/e2e/helpers/activity-runner';
import { seedClass, cleanupClass, loginStudent, testDatabaseUrl, SeededClass } from '../tests/e2e/helpers/loginStudent';

/**
 * Full browser audit of every inventory question.
 * Starts its own `vite preview` on the TEST database (run `npx vite build` first), seeds a
 * class, logs a student in through /c/:code + picture PIN, then plays each question.
 *   npx tsx scripts/run-full-browser-audit.ts            (all questions)
 *   AUDIT_LIMIT=20 npx tsx scripts/run-full-browser-audit.ts   (first 20, for a quick check)
 */

interface InventoryItem {
  module: string;
  activity_file: string;
  activity_id: string;
  question_id: string;
  activity_type: string;
  prompt: string;
  expected_answer: string;
  options: string[];
  units: string[];
  image: string | null;
  target_word: string | null;
  level: string | null;
  has_image: boolean;
  has_options: boolean;
  has_units: boolean;
  has_expected_answer: boolean;
}

export interface QuestionAuditResult {
  questionId: string;
  activityId: string;
  module: string;
  activityType: string;
  prompt: string;
  expectedAnswer: string;
  hasImage: boolean;
  imagePath: string | null;
  imageLoaded: boolean | null;
  imageNaturalWidth?: number;
  rendered: boolean;
  correctAnswerAccepted: boolean;
  incorrectAnswerTested?: boolean;
  incorrectAnswerRejected?: boolean;
  retryButtonVerified?: boolean;
  progressUpdated: boolean;
  attemptRecorded: boolean;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  errors: string[];
  durationMs: number;
}

interface BrowserErrorLog {
  activityId: string;
  type: 'console' | 'pageerror' | 'requestfailed';
  message: string;
  timestamp: string;
}

const REPORT_DIR = path.resolve('qa-report');
const AUDIT_PORT = 4174;
const BASE_URL = `http://localhost:${AUDIT_PORT}`;
const STUDENT_STATE = path.join(REPORT_DIR, '.auth', 'audit-student.json');
const CONCURRENCY = 2; // 2 workers ensures minimal memory footprint and zero browser exhaustion
const RECYCLE_EVERY_N = 35; // Recycle browser context every 35 questions to keep RAM flat

async function runWorker(
  workerId: number,
  browser: Browser,
  items: InventoryItem[],
  testedTypesForIncorrect: Set<string>,
  allResults: QuestionAuditResult[],
  errorLogs: BrowserErrorLog[],
  onItemCompleted: () => void
) {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  async function initContext() {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});

    // Every context carries the audit student's server session (logged in once in main()).
    context = await browser.newContext({ storageState: STUDENT_STATE });
    page = await context.newPage();

    // Track browser health
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('vercel-scripts') && !text.includes('favicon')) {
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
      if (!url.includes('vercel-scripts') && !url.includes('favicon')) {
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
    // Periodically recycle context to keep memory flat
    if (idx > 0 && idx % RECYCLE_EVERY_N === 0) {
      await initContext();
    }

    const item = items[idx];
    const start = Date.now();
    const errors: string[] = [];
    const isArrange = item.activity_type.toLowerCase().includes('arrange');

    const result: QuestionAuditResult = {
      questionId: item.question_id,
      activityId: item.activity_id,
      module: item.module,
      activityType: item.activity_type,
      prompt: item.prompt,
      expectedAnswer: item.expected_answer,
      hasImage: item.has_image,
      imagePath: item.image,
      imageLoaded: item.has_image ? false : null,
      rendered: false,
      correctAnswerAccepted: false,
      progressUpdated: false,
      attemptRecorded: false,
      status: 'FAIL',
      errors,
      durationMs: 0
    };

    try {
      if (!page) await initContext();

      // 1. Navigate to activity
      await page!.goto(`${BASE_URL}/session/3/tamil/play?activityId=${encodeURIComponent(item.activity_id)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // 2. Verify rendering
      const card = page!.locator('h2, [data-testid="activity-card"]').first();
      await card.waitFor({ state: 'visible', timeout: 7000 });
      result.rendered = true;

      // 3. Image verification
      if (item.has_image && item.image) {
        const img = page!.locator('img[data-testid="activity-asset-image"]');
        let imgVisible = false;
        try {
          await img.waitFor({ state: 'visible', timeout: 5000 });
          imgVisible = true;
        } catch {
          imgVisible = false;
        }

        if (imgVisible) {
          const nw = await img.evaluate(async (el: HTMLImageElement) => {
            if (!el.complete) {
              await new Promise(r => {
                el.onload = el.onerror = r;
                setTimeout(r, 4000);
              });
            }
            return el.naturalWidth;
          }).catch(() => 0);
          result.imageNaturalWidth = nw;
          if (nw > 0) {
            result.imageLoaded = true;
          } else {
            result.imageLoaded = false;
            errors.push(`Image rendered but naturalWidth is 0: ${item.image}`);
          }
        } else {
          result.imageLoaded = false;
          errors.push(`Image element missing or fallback displayed for: ${item.image}`);
        }
      }

      // Determine choice target
      let targetChoice = item.expected_answer;
      if (!isArrange && item.options && item.options.length > 0 && !item.options.includes(targetChoice)) {
        const subMatch = item.options.find(opt =>
          (item.target_word && item.target_word.includes(opt)) ||
          (item.expected_answer && item.expected_answer.includes(opt))
        );
        if (subMatch) {
          targetChoice = subMatch;
        }
      }

      // 4. Incorrect answer & retry test (once per activity type)
      const shouldTestIncorrect = !testedTypesForIncorrect.has(item.activity_type);
      if (shouldTestIncorrect) {
        testedTypesForIncorrect.add(item.activity_type);
        result.incorrectAnswerTested = true;

        if (isArrange) {
          const availableBtns = page!.locator('button[aria-label^="Select "]');
          const count = await availableBtns.count();
          if (count >= 2) {
            // Select single token to ensure incomplete/incorrect arrangement
            await availableBtns.first().click();

            const checkBtn = page!.locator('button', { hasText: 'விடையைச் சரிபார்' });
            if (await checkBtn.isEnabled()) {
              await checkBtn.click();
              const wrongFeedback = page!.locator('text=தவறான விடை');
              const retryBtn = page!.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
              try {
                await wrongFeedback.waitFor({ state: 'visible', timeout: 4000 });
                await retryBtn.waitFor({ state: 'visible', timeout: 4000 });
                result.incorrectAnswerRejected = true;
                result.retryButtonVerified = true;
                await retryBtn.click();
                await page!.waitForTimeout(200);
              } catch {
                errors.push('Incorrect arrange answer was not rejected with retry button');
              }
            }
          }
        } else {
          // Choice: Pick wrong answer
          const allOptionBtns = page!.locator('button[lang="ta"]');
          const count = await allOptionBtns.count();
          let clickedWrong = false;
          for (let i = 0; i < count; i++) {
            const btn = allOptionBtns.nth(i);
            const txt = (await btn.innerText()).trim();
            if (txt !== targetChoice && txt !== item.expected_answer && txt !== item.target_word) {
              await btn.click();
              clickedWrong = true;
              break;
            }
          }
          if (clickedWrong) {
            const checkBtn = page!.locator('button', { hasText: 'விடையைச் சரிபார்' });
            if (await checkBtn.isEnabled()) {
              await checkBtn.click();
              const wrongFeedback = page!.locator('text=தவறான விடை');
              const retryBtn = page!.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
              try {
                await wrongFeedback.waitFor({ state: 'visible', timeout: 4000 });
                await retryBtn.waitFor({ state: 'visible', timeout: 4000 });
                result.incorrectAnswerRejected = true;
                result.retryButtonVerified = true;
                await retryBtn.click();
                await page!.waitForTimeout(200);
              } catch {
                errors.push('Incorrect choice answer was not rejected with retry button');
              }
            }
          }
        }
      }

      // 5. Submit correct answer
      if (isArrange) {
        // Clear any already selected tokens
        const removeBtns = page!.locator('button[aria-label^="Remove "]');
        while (await removeBtns.count() > 0) {
          await removeBtns.first().click();
          await page!.waitForTimeout(80);
        }

        const availableBtns = page!.locator('button[aria-label^="Select "]');
        const tokenCount = await availableBtns.count();
        const availablePool: string[] = [];
        for (let i = 0; i < tokenCount; i++) {
          const ariaLabel = await availableBtns.nth(i).getAttribute('aria-label') || '';
          availablePool.push(ariaLabel.replace(/^Select\s+/, '').trim());
        }

        const tokenSequence = findTokenSequence(item.expected_answer, availablePool)
          || (item.target_word ? findTokenSequence(item.target_word, availablePool) : null)
          || item.units;

        if (!tokenSequence || tokenSequence.length === 0) {
          errors.push(`Could not determine token arrangement sequence for: ${item.expected_answer}`);
        } else {
          for (const unit of tokenSequence) {
            const btn = page!.locator(`button[aria-label="Select ${unit}"]`).first();
            if (await btn.isVisible().catch(() => false)) {
              await btn.click();
              await page!.waitForTimeout(60);
            } else {
              const btnByText = page!.getByRole('button', { name: unit, exact: true }).first();
              if (await btnByText.isVisible().catch(() => false)) {
                await btnByText.click();
                await page!.waitForTimeout(60);
              } else {
                errors.push(`Token button not found: ${unit}`);
              }
            }
          }
        }
      } else {
        // Choice: Target determined above
        let correctBtn = page!.getByRole('button', { name: targetChoice, exact: true });
        let exists = await correctBtn.isVisible().catch(() => false);

        if (!exists && item.target_word) {
          correctBtn = page!.getByRole('button', { name: item.target_word, exact: true });
          exists = await correctBtn.isVisible().catch(() => false);
        }

        if (!exists) {
          const allBtns = page!.locator('button[lang="ta"]');
          const count = await allBtns.count();
          let found = false;
          for (let i = 0; i < count; i++) {
            const btn = allBtns.nth(i);
            const txt = (await btn.innerText()).trim();
            if (txt === targetChoice || txt === item.expected_answer || txt === item.target_word) {
              await btn.click();
              found = true;
              break;
            }
          }
          if (!found) {
            errors.push(`Choice button not found for: ${targetChoice} (expected: ${item.expected_answer})`);
          }
        } else {
          await correctBtn.first().click();
        }
      }

      // Click "விடையைச் சரிபார்"
      const checkBtn = page!.locator('button', { hasText: 'விடையைச் சரிபார்' });
      await checkBtn.waitFor({ state: 'visible', timeout: 3000 });
      if (await checkBtn.isEnabled()) {
        await checkBtn.click();
      }

      // Verify success feedback
      const successFeedback = page!.locator('text=சரியான விடை!');
      try {
        await successFeedback.waitFor({ state: 'visible', timeout: 5000 });
        result.correctAnswerAccepted = true;
      } catch {
        errors.push('Correct feedback "சரியான விடை!" did not appear');
      }

      // Verify Continue button ("தொடர்க") appears
      const continueBtn = page!.locator('button', { hasText: 'தொடர்க' });
      try {
        await continueBtn.waitFor({ state: 'visible', timeout: 3000 });
      } catch {
        errors.push('Continue button "தொடர்க" did not appear');
      }

      // Verify localStorage progress & attempts with brief wait for async write
      let storageData = { prog: '', att: '' };
      for (let retries = 0; retries < 6; retries++) {
        storageData = await page!.evaluate(() => ({
          prog: localStorage.getItem('sa.learning.progress.v2') || localStorage.getItem('sa.learning.progress.v1') || '',
          att: localStorage.getItem('sa.learning.attempts.v1') || localStorage.getItem('sa.attempts.v1') || ''
        }));
        if (storageData.prog.includes(item.activity_id) && storageData.att.includes(item.activity_id)) {
          break;
        }
        await page!.waitForTimeout(150);
      }

      result.progressUpdated = Boolean(storageData.prog && storageData.prog.includes(item.activity_id));
      result.attemptRecorded = Boolean(storageData.att && storageData.att.includes(item.activity_id));

      if (!result.progressUpdated) {
        errors.push('Activity completion was not saved in localStorage progress');
      }
      if (!result.attemptRecorded) {
        errors.push('Activity attempt was not saved in localStorage attempts');
      }

      // Determine final status
      if (result.rendered && (!item.has_image || result.imageLoaded) && result.correctAnswerAccepted && errors.length === 0) {
        result.status = 'PASS';
      } else {
        result.status = 'FAIL';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Unhandled execution error: ${msg}`);
      result.status = 'FAIL';
      // If error indicates page or context closure, force recreation
      if (msg.includes('closed')) {
        await initContext();
      }
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
  console.log('   SARA PLATFORM — FULL END-TO-END BROWSER PLAYWRIGHT AUDIT     ');
  console.log('================================================================\n');

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const inventoryPath = path.join(REPORT_DIR, 'inventory.json');
  if (!fs.existsSync(inventoryPath)) {
    throw new Error('Authoritative inventory not found. Run scripts/generate-authoritative-inventory.ts first.');
  }

  const inventoryData = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const limit = Number(process.env.AUDIT_LIMIT) || undefined;
  const items: InventoryItem[] = limit ? inventoryData.items.slice(0, limit) : inventoryData.items;

  console.log(`Loaded authoritative inventory: ${items.length} questions across 8 modules.`);
  console.log(`Starting headless Chromium browser audit with ${CONCURRENCY} parallel worker threads (recycling every ${RECYCLE_EVERY_N} questions)...\n`);

  const server = await startPreviewOnTestDb();
  const seeded = await seedClass({ tag: 'audit', students: ['Audit'] });
  try {
    await runAudit(items, seeded);
  } finally {
    await cleanupClass(seeded);
    stopServer(server);
  }
}

/** Stops the preview server and its children (on Windows, kill() would only stop the shell). */
function stopServer(server: ChildProcess) {
  if (process.platform === 'win32' && server.pid) {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill();
  }
}

/** `vite preview` with DATABASE_URL = TEST_DATABASE_URL for this process only. */
async function startPreviewOnTestDb(): Promise<ChildProcess> {
  const testDbUrl = testDatabaseUrl();
  const server = spawn('npx', ['vite', 'preview', '--port', String(AUDIT_PORT), '--strictPort'], {
    env: { ...process.env, DATABASE_URL: testDbUrl, DATABASE_URL_UNPOOLED: testDbUrl },
    shell: true,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        console.log(`Preview on TEST database ready at ${BASE_URL}`);
        return server;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  stopServer(server);
  throw new Error('vite preview did not start; run `npx vite build` first.');
}

async function runAudit(items: InventoryItem[], seeded: SeededClass) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Log the audit student in once, the way a child does, and reuse the session.
  fs.mkdirSync(path.dirname(STUDENT_STATE), { recursive: true });
  const loginPage = await browser.newPage();
  await loginStudent(loginPage, seeded, 'Audit', BASE_URL);
  await loginPage.context().storageState({ path: STUDENT_STATE });
  await loginPage.context().close();

  const allResults: QuestionAuditResult[] = [];
  const errorLogs: BrowserErrorLog[] = [];
  const testedTypesForIncorrect = new Set<string>();

  // Distribute items across workers round-robin
  const workerItems: InventoryItem[][] = Array.from({ length: CONCURRENCY }, () => []);
  items.forEach((item, idx) => {
    workerItems[idx % CONCURRENCY].push(item);
  });

  let completedCount = 0;
  const total = items.length;
  const startTime = Date.now();

  const onItemCompleted = () => {
    completedCount++;
    if (completedCount % 25 === 0 || completedCount === total) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const passedCount = allResults.filter(r => r.status === 'PASS').length;
      const failedCount = allResults.filter(r => r.status === 'FAIL').length;
      console.log(`[Progress: ${completedCount}/${total}] (${((completedCount / total) * 100).toFixed(1)}%) | Elapsed: ${elapsedSec}s | Passed: ${passedCount} | Failed: ${failedCount}`);

      // Periodically flush live results to disk
      fs.writeFileSync(path.join(REPORT_DIR, 'question-results.json'), JSON.stringify(allResults, null, 2), 'utf8');
    }
  };

  await Promise.all(
    workerItems.map((wItems, idx) =>
      runWorker(idx, browser, wItems, testedTypesForIncorrect, allResults, errorLogs, onItemCompleted)
    )
  );

  await browser.close();

  const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll ${total} questions tested in ${totalDurationSec}s.`);

  // 1. Save final question-results.json
  fs.writeFileSync(path.join(REPORT_DIR, 'question-results.json'), JSON.stringify(allResults, null, 2), 'utf8');

  // 2. Generate activity-type-results.json
  const activityTypeMap: Record<string, { total: number; passed: number; failed: number; incorrectTested: boolean; incorrectPassed: boolean }> = {};
  allResults.forEach(r => {
    if (!activityTypeMap[r.activityType]) {
      activityTypeMap[r.activityType] = { total: 0, passed: 0, failed: 0, incorrectTested: false, incorrectPassed: false };
    }
    activityTypeMap[r.activityType].total++;
    if (r.status === 'PASS') activityTypeMap[r.activityType].passed++;
    if (r.status === 'FAIL') activityTypeMap[r.activityType].failed++;
    if (r.incorrectAnswerTested) {
      activityTypeMap[r.activityType].incorrectTested = true;
      if (r.incorrectAnswerRejected && r.retryButtonVerified) {
        activityTypeMap[r.activityType].incorrectPassed = true;
      }
    }
  });
  fs.writeFileSync(path.join(REPORT_DIR, 'activity-type-results.json'), JSON.stringify(activityTypeMap, null, 2), 'utf8');

  // 3. Generate module breakdown
  const moduleMap: Record<string, { total: number; passed: number; failed: number; imageTotal: number; imagePassed: number }> = {};
  allResults.forEach(r => {
    if (!moduleMap[r.module]) {
      moduleMap[r.module] = { total: 0, passed: 0, failed: 0, imageTotal: 0, imagePassed: 0 };
    }
    moduleMap[r.module].total++;
    if (r.status === 'PASS') moduleMap[r.module].passed++;
    if (r.status === 'FAIL') moduleMap[r.module].failed++;
    if (r.hasImage) {
      moduleMap[r.module].imageTotal++;
      if (r.imageLoaded) moduleMap[r.module].imagePassed++;
    }
  });

  // 4. Generate browser-errors.json
  fs.writeFileSync(path.join(REPORT_DIR, 'browser-errors.json'), JSON.stringify(errorLogs, null, 2), 'utf8');

  // 5. Generate summary.md
  const totalPassed = allResults.filter(r => r.status === 'PASS').length;
  const totalFailed = allResults.filter(r => r.status === 'FAIL').length;
  const totalImages = allResults.filter(r => r.hasImage).length;
  const imagesLoaded = allResults.filter(r => r.hasImage && r.imageLoaded).length;

  const summaryMd = `# Sara Platform — Complete Browser Playwright QA Audit Summary

Generated: ${new Date().toISOString()}

## Executive Summary

- **Total Questions Audited in Browser**: ${allResults.length}
- **Passing Questions**: ${totalPassed} (${((totalPassed / allResults.length) * 100).toFixed(2)}%)
- **Failing Questions**: ${totalFailed} (${((totalFailed / allResults.length) * 100).toFixed(2)}%)
- **Total Images Verified**: ${totalImages} (Loaded successfully: ${imagesLoaded})
- **Evaluator Types Tested with Incorrect/Retry Flow**: ${Object.keys(activityTypeMap).length}
- **Total Audit Execution Time**: ${totalDurationSec}s

## Module Results

| Module | Total Questions | Passed | Failed | Pass Rate | Images Verified |
| :--- | :--- | :--- | :--- | :--- | :--- |
${Object.entries(moduleMap).map(([m, stats]) => `| ${m} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${((stats.passed / stats.total) * 100).toFixed(1)}% | ${stats.imagePassed}/${stats.imageTotal} |`).join('\n')}

## Activity / Evaluator Type Results

| Activity Type | Total Questions | Passed | Failed | Pass Rate | Incorrect/Retry Verified |
| :--- | :--- | :--- | :--- | :--- | :--- |
${Object.entries(activityTypeMap).map(([t, stats]) => `| ${t} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${((stats.passed / stats.total) * 100).toFixed(1)}% | ${stats.incorrectPassed ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

## Browser Diagnostics & Console Errors
- Total Unexpected Browser Error Events Recorded: ${errorLogs.length}

## Defect Inventory & Findings
${totalFailed === 0 ? 'No functional, content, evaluator, or image loading defects detected across all ${allResults.length} audited questions.' : allResults.filter(r => r.status === 'FAIL').map(r => `- **${r.activityId}** (${r.activityType}): ${r.errors.join('; ')}`).join('\n')}
`;

  fs.writeFileSync(path.join(REPORT_DIR, 'summary.md'), summaryMd, 'utf8');

  console.log('\n================================================================');
  console.log(`   AUDIT COMPLETE: ${totalPassed}/${total} PASSED (${((totalPassed / total) * 100).toFixed(2)}%)`);
  console.log(`   Results saved to: qa-report/`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
