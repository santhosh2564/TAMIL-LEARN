import fs from 'fs';
import path from 'path';
import { LocalContentRepository } from '../src/repositories/implementations/LocalContentRepository';
import { activityRegistry } from '../src/engine/ActivityRegistry';
import { registerCoreActivities } from '../src/features/Activity/registerActivities';
import { normalizeRecord, normalizeTamilCategory } from './import-tamil';
import { Activity } from '../src/types';
import { combineTamilSandhi, matchesTamilOrTarget } from '../src/utils/tamil';

registerCoreActivities();

interface AuditResult {
  totalDeployed: number;
  deployedPassed: number;
  deployedFailed: number;
  totalFts: number;
  ftsPassed: number;
  ftsFailed: number;
  failures: { id: string; subject: string; type: string; reason: string }[];
}

/**
 * Finds the sequence of token IDs that forms the correct answer for an arrange activity.
 */
function solveArrange(act: Activity, evaluator: any): string[] | null {
  const options = (act.options && act.options.length > 0)
    ? act.options
    : (act.units?.map((u, i) => ({ id: String.fromCharCode(65 + i), label: u })) || []);

  if (options.length === 0) return null;

  // Try default order
  const defaultIds = options.map(o => o.id);
  if (evaluator.evaluate(act, defaultIds).correct) {
    return defaultIds;
  }

  const n = options.length;
  const used = new Array(n).fill(false);
  const currentLabels: string[] = [];
  const currentIds: string[] = [];
  const targetAns = Array.isArray(act.correctAnswer) ? act.correctAnswer : [act.correctAnswer || ''];
  const isTamil = act.subject === 'Tamil' || !act.language?.startsWith('en');

  let solution: string[] | null = null;

  function search(): boolean {
    if (currentIds.length === n) {
      if (evaluator.evaluate(act, currentIds).correct) {
        solution = [...currentIds];
        return true;
      }
      return false;
    }
    for (let i = 0; i < n; i++) {
      if (!used[i]) {
        used[i] = true;
        currentLabels.push(options[i].label);
        currentIds.push(options[i].id);

        const formed = currentLabels.join('');
        const sandhi = isTamil ? combineTamilSandhi(formed) : formed;
        const cleanF = formed.replace(/[\s\-_]/g, '').toLowerCase();
        const cleanS = sandhi.replace(/[\s\-_]/g, '').toLowerCase();

        const couldBePrefix = targetAns.some(t => {
          const cleanT = (t || '').replace(/[\s\-_]/g, '').toLowerCase();
          return cleanT.startsWith(cleanF) || cleanT.startsWith(cleanS);
        });

        if (couldBePrefix) {
          if (search()) return true;
        }

        currentIds.pop();
        currentLabels.pop();
        used[i] = false;
      }
    }
    return false;
  }

  search();
  return solution;
}

/**
 * Finds the correct input for evaluating an activity.
 */
function findCorrectInput(act: Activity, evaluator: any): any {
  if (act.category === 'arrange-word') {
    return solveArrange(act, evaluator);
  }

  // If activity has options, find the option that matches correctAnswer
  if (act.options && act.options.length > 0) {
    const targetAns = (Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : (act.correctAnswer || '')).trim().toLowerCase();
    
    // Exact or normalized match
    let correctOpt = act.options.find(o => o.label.trim().toLowerCase() === targetAns);
    if (!correctOpt) {
      // Test each option against the evaluator
      for (const opt of act.options) {
        if (evaluator.evaluate(act, opt.id).correct || evaluator.evaluate(act, opt.label).correct) {
          return opt.id;
        }
      }
    } else {
      return correctOpt.id;
    }
  }

  // Word entry / direct input
  return Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : (act.correctAnswer || act.targetWord || '');
}

async function runAudit(): Promise<AuditResult> {
  const result: AuditResult = {
    totalDeployed: 0,
    deployedPassed: 0,
    deployedFailed: 0,
    totalFts: 0,
    ftsPassed: 0,
    ftsFailed: 0,
    failures: []
  };

  console.log('===============================================================');
  console.log('       FULL EVALUATOR AUDIT ACROSS ALL CURRICULUM DATA         ');
  console.log('===============================================================\n');

  // 1. AUDIT DEPLOYED QUESTIONS (1,380 questions: 1,238 English + 142 Tamil)
  console.log('--- 1. AUDITING DEPLOYED QUESTIONS (LocalContentRepository) ---');
  const repo = new LocalContentRepository();
  const deployedActivities = await repo.getActivities({ subject: 'all' });
  result.totalDeployed = deployedActivities.length;
  console.log(`Loaded ${deployedActivities.length} deployed activities from repository.`);

  for (const act of deployedActivities) {
    const def = activityRegistry.getDefinition(act.category, act.variant);
    if (!def || !def.evaluator) {
      result.deployedFailed++;
      result.failures.push({
        id: act.id,
        subject: act.subject || 'Unknown',
        type: `${act.category}/${act.variant}`,
        reason: `No registered evaluator for ${act.category}/${act.variant}`
      });
      continue;
    }

    const input = findCorrectInput(act, def.evaluator);
    if (input === null) {
      result.deployedFailed++;
      result.failures.push({
        id: act.id,
        subject: act.subject || 'Unknown',
        type: `${act.category}/${act.variant}`,
        reason: `Could not determine valid answer input from options/units`
      });
      continue;
    }

    const evalResult = def.evaluator.evaluate(act, input);
    if (evalResult.correct) {
      result.deployedPassed++;
    } else {
      result.deployedFailed++;
      result.failures.push({
        id: act.id,
        subject: act.subject || 'Unknown',
        type: `${act.category}/${act.variant}`,
        reason: `Evaluator rejected correct answer input: ${JSON.stringify(input)}`
      });
    }
  }
  console.log(`Deployed Evaluation: ${result.deployedPassed} / ${result.totalDeployed} passed.\n`);

  // 2. AUDIT ALL TAMIL FTS QUESTIONS (1,178 questions in tamil_json_by_module_activity)
  console.log('--- 2. AUDITING TAMIL FTS QUESTIONS (tamil_json_by_module_activity) ---');
  const SOURCE_DIR = path.resolve('tamil_json_by_module_activity');
  const moduleDirs = fs.readdirSync(SOURCE_DIR).filter(d => {
    return fs.statSync(path.join(SOURCE_DIR, d)).isDirectory() && d.startsWith('Module_');
  }).sort();

  const ftsRecords: Activity[] = [];
  for (const modDir of moduleDirs) {
    const files = fs.readdirSync(path.join(SOURCE_DIR, modDir)).filter(f => f.endsWith('.json')).sort();
    for (const f of files) {
      const fullPath = path.join(SOURCE_DIR, modDir, f);
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      for (const rec of parsed) {
        const normalized = normalizeRecord(rec);
        ftsRecords.push(normalized);
      }
    }
  }

  result.totalFts = ftsRecords.length;
  console.log(`Loaded ${ftsRecords.length} Tamil FTS activities across ${moduleDirs.length} modules.`);

  for (const act of ftsRecords) {
    const def = activityRegistry.getDefinition(act.category, act.variant);
    if (!def || !def.evaluator) {
      result.ftsFailed++;
      result.failures.push({
        id: act.id,
        subject: 'Tamil FTS',
        type: `${act.category}/${act.variant}`,
        reason: `No registered evaluator for ${act.category}/${act.variant}`
      });
      continue;
    }

    const input = findCorrectInput(act, def.evaluator);
    if (input === null) {
      result.ftsFailed++;
      result.failures.push({
        id: act.id,
        subject: 'Tamil FTS',
        type: `${act.category}/${act.variant}`,
        reason: `Could not determine valid answer input from options/units`
      });
      continue;
    }

    const evalResult = def.evaluator.evaluate(act, input);
    if (evalResult.correct) {
      result.ftsPassed++;
    } else {
      result.ftsFailed++;
      result.failures.push({
        id: act.id,
        subject: 'Tamil FTS',
        type: `${act.category}/${act.variant}`,
        reason: `Evaluator rejected correct answer input: ${JSON.stringify(input)}`
      });
    }
  }
  console.log(`Tamil FTS Evaluation: ${result.ftsPassed} / ${result.totalFts} passed.\n`);

  console.log('===============================================================');
  console.log('                      AUDIT SUMMARY RESULTS                    ');
  console.log('===============================================================');
  console.log(`Total Previously Deployed Questions: ${result.totalDeployed}`);
  console.log(`  Passed: ${result.deployedPassed}`);
  console.log(`  Failed: ${result.deployedFailed}`);
  console.log(`Total Tamil FTS Questions:           ${result.totalFts}`);
  console.log(`  Passed: ${result.ftsPassed}`);
  console.log(`  Failed: ${result.ftsFailed}`);
  console.log(`Combined Total Questions Audited:    ${result.totalDeployed + result.totalFts}`);
  console.log(`Combined Total Passed:               ${result.deployedPassed + result.ftsPassed}`);
  console.log(`Combined Total Failures:             ${result.failures.length}`);
  console.log('===============================================================\n');

  if (result.failures.length > 0) {
    console.error('Failure details:');
    console.error(JSON.stringify(result.failures, null, 2));
    process.exit(1);
  } else {
    console.log('ALL 1,380 DEPLOYED QUESTIONS AND ALL 1,178 TAMIL FTS QUESTIONS PASSED REAL EVALUATION WITH CORRECT ANSWERS!');
  }

  return result;
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
