import * as fs from 'fs';
import * as path from 'path';
import { Activity } from '../src/types';
import { activityRegistry } from '../src/engine';
import { registerCoreActivities } from '../src/features/Activity/registerActivities';
import { AssetResolver } from '../src/engine/assets';

registerCoreActivities();

const ENG_DIR = path.resolve('src/content/class-3/english');
const PUBLIC_DIR = path.resolve('public');

export interface ContentAuditReport {
  timestamp: string;
  totalModules: number;
  totalActivityFiles: number;
  totalQuestions: number;
  moduleBreakdown: Record<number, {
    file: string;
    total: number;
    newWords: number;
    reviewWords: number;
    categories: Record<string, number>;
    variants: Record<string, number>;
    codes: Record<string, number>;
  }>;
  categoryTotals: Record<string, number>;
  variantTotals: Record<string, number>;
  activityCodeTotals: Record<string, number>;
  imagesSummary: {
    totalRequiringVisual: number;
    resolvedToDisk: number;
    missingHandledByFallback: number;
    physicalFileMissingOnDisk: number;
    manifestUniqueKeys: number;
  };
  textValidation: {
    corruptedCharacters: number;
    placeholderTexts: number;
    undefinedOrNullStrings: number;
    emptyPrompts: number;
    emptyAnswers: number;
    duplicateOptions: number;
    optionMismatchWithAnswer: number;
    issues: string[];
  };
  evaluatorValidation: {
    tested: number;
    correctAccepted: number;
    incorrectRejected: number;
    failures: Array<{
      activityId: string;
      code?: string;
      category: string;
      variant: string;
      reason: string;
    }>;
  };
  status: 'PASS' | 'FAIL';
}

export function runEnglishContentAudit(): ContentAuditReport {
  const report: ContentAuditReport = {
    timestamp: new Date().toISOString(),
    totalModules: 8,
    totalActivityFiles: 8,
    totalQuestions: 0,
    moduleBreakdown: {},
    categoryTotals: {},
    variantTotals: {},
    activityCodeTotals: {},
    imagesSummary: {
      totalRequiringVisual: 0,
      resolvedToDisk: 0,
      missingHandledByFallback: 0,
      physicalFileMissingOnDisk: 0,
      manifestUniqueKeys: 0
    },
    textValidation: {
      corruptedCharacters: 0,
      placeholderTexts: 0,
      undefinedOrNullStrings: 0,
      emptyPrompts: 0,
      emptyAnswers: 0,
      duplicateOptions: 0,
      optionMismatchWithAnswer: 0,
      issues: []
    },
    evaluatorValidation: {
      tested: 0,
      correctAccepted: 0,
      incorrectRejected: 0,
      failures: []
    },
    status: 'PASS'
  };

  const assetResolver = new AssetResolver();
  const seenIds = new Set<string>();
  const allActivities: Activity[] = [];

  for (let m = 1; m <= 8; m++) {
    const actFile = path.join(ENG_DIR, `module-${m}`, 'activities.json');
    if (!fs.existsSync(actFile)) {
      report.textValidation.issues.push(`Module ${m} activities.json is missing`);
      report.status = 'FAIL';
      continue;
    }

    const raw = fs.readFileSync(actFile, 'utf8');
    let activities: Activity[] = [];
    try {
      activities = JSON.parse(raw);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      report.textValidation.issues.push(`Module ${m} activities.json JSON parse error: ${msg}`);
      report.status = 'FAIL';
      continue;
    }


    const breakdown = {
      file: `src/content/class-3/english/module-${m}/activities.json`,
      total: activities.length,
      newWords: 0,
      reviewWords: 0,
      categories: {} as Record<string, number>,
      variants: {} as Record<string, number>,
      codes: {} as Record<string, number>
    };

    for (const act of activities) {
      allActivities.push(act);
      report.totalQuestions++;

      // ID check
      if (!act.id) {
        report.textValidation.issues.push(`Activity missing ID in module ${m}`);
      } else if (seenIds.has(act.id)) {
        report.textValidation.issues.push(`Duplicate ID: ${act.id}`);
      } else {
        seenIds.add(act.id);
      }

      // Role check
      if (act.role === 'new') breakdown.newWords++;
      else if (act.role === 'review') breakdown.reviewWords++;

      // Category / Variant / Code tally
      const cat = act.category || 'unknown';
      const variant = act.variant || 'unknown';
      const code = act.source?.activityCode || 'unknown';

      breakdown.categories[cat] = (breakdown.categories[cat] || 0) + 1;
      breakdown.variants[variant] = (breakdown.variants[variant] || 0) + 1;
      breakdown.codes[code] = (breakdown.codes[code] || 0) + 1;

      report.categoryTotals[cat] = (report.categoryTotals[cat] || 0) + 1;
      report.variantTotals[variant] = (report.variantTotals[variant] || 0) + 1;
      report.activityCodeTotals[code] = (report.activityCodeTotals[code] || 0) + 1;

      // Text checks
      const fieldsToCheck = [
        act.prompt,
        act.instruction,
        act.template,
        act.targetWord,
        typeof act.correctAnswer === 'string' ? act.correctAnswer : act.correctAnswer?.join(',')
      ];

      for (const str of fieldsToCheck) {
        if (!str) continue;
        if (str.includes('undefined') || str.includes('null') || str.includes('[object Object]') || str.includes('NaN')) {
          report.textValidation.undefinedOrNullStrings++;
          report.textValidation.issues.push(`${act.id}: prompt/text contains invalid string token "${str}"`);
        }
        if (/TODO|FIXME|LOREM|TBD/i.test(str)) {
          report.textValidation.placeholderTexts++;
          report.textValidation.issues.push(`${act.id}: contains placeholder text "${str}"`);
        }
        if (str.includes('\uFFFD') || str.includes('ï¿½')) {
          report.textValidation.corruptedCharacters++;
          report.textValidation.issues.push(`${act.id}: contains corrupted unicode character`);
        }
      }

      if (!act.prompt || act.prompt.trim() === '') {
        report.textValidation.emptyPrompts++;
        report.textValidation.issues.push(`${act.id}: prompt is empty`);
      }

      if (!act.correctAnswer || (Array.isArray(act.correctAnswer) && act.correctAnswer.length === 0)) {
        report.textValidation.emptyAnswers++;
        report.textValidation.issues.push(`${act.id}: correctAnswer is empty`);
      }

      // Check options uniqueness for SELECT variants (not arrange-word, where words have duplicate letters)
      if (act.options && act.options.length > 0 && act.variant === 'select') {
        const labels = act.options.map(o => o.label.trim().toLowerCase());
        const uniqueLabels = new Set(labels);
        if (uniqueLabels.size !== labels.length) {
          report.textValidation.duplicateOptions++;
          report.textValidation.issues.push(`${act.id}: duplicate options detected: ${labels.join(', ')}`);
        }

        const ans = (typeof act.correctAnswer === 'string' ? act.correctAnswer : act.correctAnswer[0]).trim().toLowerCase();
        const hasAnswerInOptions = labels.some(l => l === ans);
        if (!hasAnswerInOptions) {
          report.textValidation.optionMismatchWithAnswer++;
          report.textValidation.issues.push(`${act.id}: correctAnswer "${ans}" not found in options [${labels.join(', ')}]`);
        }
      }

      // Visual Asset Check
      const isPicRec = act.category === 'picture-recognition';
      const mentionsPic = /look at the picture|picture/i.test(act.prompt || '');
      const hasImgProp = Boolean(act.image?.source);
      if (isPicRec || mentionsPic || hasImgProp) {
        report.imagesSummary.totalRequiringVisual++;
        const semanticKey = act.targetWord
          ? `eng-${act.targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
          : (act.source?.ewId ? `eng-${act.source.ewId.toLowerCase()}` : 'unknown');

        const assetId = act.image?.source || semanticKey;
        const res = assetResolver.resolve({ id: assetId, type: 'image' });

        if (res.status === 'resolved') {
          const diskPath = path.resolve(PUBLIC_DIR, res.asset.path.replace(/^\//, ''));
          if (fs.existsSync(diskPath) && fs.statSync(diskPath).size > 0) {
            report.imagesSummary.resolvedToDisk++;
          } else {
            report.imagesSummary.physicalFileMissingOnDisk++;
            report.textValidation.issues.push(`${act.id}: Image file missing from disk: ${diskPath}`);
          }
        } else {
          report.imagesSummary.missingHandledByFallback++;
        }
      }

      // Evaluator check
      report.evaluatorValidation.tested++;
      const def = activityRegistry.getDefinition(act.category, act.variant);
      if (!def) {
        report.evaluatorValidation.failures.push({
          activityId: act.id,
          code,
          category: act.category,
          variant: act.variant,
          reason: `No definition registered in ActivityRegistry for ${act.category}::${act.variant}`
        });
        continue;
      }

      const evaluator = def.evaluator;
      const mockState = { activityId: act.id, status: 'idle' as const, attempts: 0 };
      const ans = typeof act.correctAnswer === 'string' ? act.correctAnswer : act.correctAnswer[0];

      try {
        if (act.variant === 'select') {
          const opt = act.options?.find(o => o.label.trim().toLowerCase() === ans.trim().toLowerCase());
          if (!opt) {
            report.evaluatorValidation.failures.push({
              activityId: act.id,
              code,
              category: act.category,
              variant: act.variant,
              reason: `Cannot find option matching answer "${ans}"`
            });
          } else {
            const resCorrect = evaluator.evaluate(act, opt.id, mockState);
            if (resCorrect.correct && resCorrect.completed) {
              report.evaluatorValidation.correctAccepted++;
            } else {
              report.evaluatorValidation.failures.push({
                activityId: act.id,
                code,
                category: act.category,
                variant: act.variant,
                reason: `Correct option ${opt.id} rejected by evaluator`
              });
            }

            const wrongOpt = act.options?.find(o => o.id !== opt.id);
            if (wrongOpt) {
              const resWrong = evaluator.evaluate(act, wrongOpt.id, mockState);
              if (!resWrong.correct && !resWrong.completed) {
                report.evaluatorValidation.incorrectRejected++;
              } else {
                report.evaluatorValidation.failures.push({
                  activityId: act.id,
                  code,
                  category: act.category,
                  variant: act.variant,
                  reason: `Wrong option ${wrongOpt.id} was incorrectly accepted!`
                });
              }
            }
          }
        } else if (act.variant === 'word-entry') {
          const resCorrect = evaluator.evaluate(act, ans, mockState);
          if (resCorrect.correct && resCorrect.completed) {
            report.evaluatorValidation.correctAccepted++;
          } else {
            report.evaluatorValidation.failures.push({
              activityId: act.id,
              code,
              category: act.category,
              variant: act.variant,
              reason: `Word entry correct answer "${ans}" rejected`
            });
          }

          const resWrong = evaluator.evaluate(act, 'wronganswerxyz999', mockState);
          if (!resWrong.correct && !resWrong.completed) {
            report.evaluatorValidation.incorrectRejected++;
          } else {
            report.evaluatorValidation.failures.push({
              activityId: act.id,
              code,
              category: act.category,
              variant: act.variant,
              reason: `Word entry wrong answer accepted`
            });
          }
        } else if (act.variant === 'missing-unit') {
          // If options exist, student clicks the option in UI
          if (act.options && act.options.length > 0) {
            const cleanedTemplate = (act.template || '').replace(/[|\s]/g, '');
            const cleanedTarget = (act.targetWord || ans).replace(/\s+/g, '');
            let missingLetter = '';
            for (let i = 0; i < cleanedTemplate.length && i < cleanedTarget.length; i++) {
              if (cleanedTemplate[i] === '_') missingLetter += cleanedTarget[i];
            }
            if (!missingLetter) missingLetter = ans;

            const opt = act.options.find(o => o.label.trim().toLowerCase() === missingLetter.toLowerCase())
              || act.options.find(o => o.label.trim().toLowerCase() === ans.toLowerCase());

            if (!opt) {
              report.evaluatorValidation.failures.push({
                activityId: act.id,
                code,
                category: act.category,
                variant: act.variant,
                reason: `Cannot find option matching missing letter "${missingLetter}"`
              });
            } else {
              const resCorrect = evaluator.evaluate(act, opt.id, mockState);
              if (resCorrect.correct && resCorrect.completed) {
                report.evaluatorValidation.correctAccepted++;
              } else {
                report.evaluatorValidation.failures.push({
                  activityId: act.id,
                  code,
                  category: act.category,
                  variant: act.variant,
                  reason: `Missing unit option ${opt.id} ("${opt.label}") rejected`
                });
              }

              const wrongOpt = act.options.find(o => o.id !== opt.id);
              if (wrongOpt) {
                const resWrong = evaluator.evaluate(act, wrongOpt.id, mockState);
                if (!resWrong.correct && !resWrong.completed) {
                  report.evaluatorValidation.incorrectRejected++;
                } else {
                  report.evaluatorValidation.failures.push({
                    activityId: act.id,
                    code,
                    category: act.category,
                    variant: act.variant,
                    reason: `Missing unit wrong option accepted`
                  });
                }
              }
            }
          } else {
            // Text input mode
            const cleanedTemplate = (act.template || '').replace(/[|\s]/g, '');
            const cleanedTarget = (act.targetWord || ans).replace(/\s+/g, '');
            let missingLetter = '';
            for (let i = 0; i < cleanedTemplate.length && i < cleanedTarget.length; i++) {
              if (cleanedTemplate[i] === '_') missingLetter += cleanedTarget[i];
            }
            if (!missingLetter) missingLetter = ans;

            const resCorrect = evaluator.evaluate(act, missingLetter, mockState);
            if (resCorrect.correct && resCorrect.completed) {
              report.evaluatorValidation.correctAccepted++;
            } else {
              report.evaluatorValidation.failures.push({
                activityId: act.id,
                code,
                category: act.category,
                variant: act.variant,
                reason: `Missing unit "${missingLetter}" rejected`
              });
            }

            const resWrong = evaluator.evaluate(act, 'z9', mockState);
            if (!resWrong.correct && !resWrong.completed) {
              report.evaluatorValidation.incorrectRejected++;
            } else {
              report.evaluatorValidation.failures.push({
                activityId: act.id,
                code,
                category: act.category,
                variant: act.variant,
                reason: `Missing unit wrong answer accepted`
              });
            }
          }
        } else if (act.variant === 'arrange') {
          const options = act.options || [];
          const targets = (Array.isArray(act.correctAnswer) ? act.correctAnswer : [act.correctAnswer])
            .map(t => t.replace(/[\s\-_]/g, '').toLowerCase());
          let foundSequence: string[] | null = null;

          for (const target of targets) {
            const correctOrderIds: string[] = [];
            let accumulated = '';
            const remaining = [...options];

            while (remaining.length > 0 && accumulated.length < target.length) {
              const nextIdx = remaining.findIndex(opt => target.startsWith(accumulated + opt.label.replace(/[\s\-_]/g, '').toLowerCase()));
              if (nextIdx !== -1) {
                accumulated += remaining[nextIdx].label.replace(/[\s\-_]/g, '').toLowerCase();
                correctOrderIds.push(remaining[nextIdx].id);
                remaining.splice(nextIdx, 1);
              } else {
                break;
              }
            }

            if (accumulated === target) {
              foundSequence = correctOrderIds;
              break;
            }
          }

          if (foundSequence) {
            const resCorrect = evaluator.evaluate(act, foundSequence, mockState);
            if (resCorrect.correct && resCorrect.completed) {
              report.evaluatorValidation.correctAccepted++;
            } else {
              report.evaluatorValidation.failures.push({
                activityId: act.id,
                code,
                category: act.category,
                variant: act.variant,
                reason: `Arrange correct units sequence rejected`
              });
            }

            // Incomplete arrangement test
            if (foundSequence.length > 1) {
              const incomplete = [foundSequence[0]];
              const resWrong = evaluator.evaluate(act, incomplete, mockState);
              if (!resWrong.correct && !resWrong.completed) {
                report.evaluatorValidation.incorrectRejected++;
              } else {
                report.evaluatorValidation.failures.push({
                  activityId: act.id,
                  code,
                  category: act.category,
                  variant: act.variant,
                  reason: `Arrange incomplete sequence accepted`
                });
              }
            }
          } else {
            report.evaluatorValidation.failures.push({
              activityId: act.id,
              code,
              category: act.category,
              variant: act.variant,
              reason: `Could not assemble arrange options [${options.map(o => o.label).join(', ')}] into targets [${targets.join(', ')}]`
            });
          }
        }


      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        report.evaluatorValidation.failures.push({
          activityId: act.id,
          code,
          category: act.category,
          variant: act.variant,
          reason: `Evaluator threw error: ${msg}`
        });
      }

    }

    report.moduleBreakdown[m] = breakdown;
  }

  // Count unique manifest keys
  const manifestPath = path.resolve('src/content/class-3/english/asset-manifest.json');
  if (fs.existsSync(manifestPath)) {
    report.imagesSummary.manifestUniqueKeys = Object.keys(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).length;
  }

  if (report.textValidation.issues.length > 0 || report.evaluatorValidation.failures.length > 0) {
    report.status = 'FAIL';
  }

  return report;
}

// Write report to json
const report = runEnglishContentAudit();
const outPath = path.resolve('qa-report/english-content-audit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

console.log('=== English Content & Evaluator Audit Results ===');
console.log(`Total Questions: ${report.totalQuestions}`);
console.log(`Evaluator tested: ${report.evaluatorValidation.tested}`);
console.log(`Correct answers accepted: ${report.evaluatorValidation.correctAccepted}`);
console.log(`Incorrect answers rejected: ${report.evaluatorValidation.incorrectRejected}`);
console.log(`Evaluator failures: ${report.evaluatorValidation.failures.length}`);
console.log(`Text/JSON issues: ${report.textValidation.issues.length}`);
console.log(`Images: ${report.imagesSummary.totalRequiringVisual} total, ${report.imagesSummary.resolvedToDisk} on disk, ${report.imagesSummary.missingHandledByFallback} fallback, ${report.imagesSummary.physicalFileMissingOnDisk} missing`);
console.log(`Status: ${report.status}`);

if (report.evaluatorValidation.failures.length > 0) {
  console.log('\nSample Evaluator Failures:');
  console.log(report.evaluatorValidation.failures.slice(0, 10));
}
if (report.textValidation.issues.length > 0) {
  console.log('\nSample Text Issues:');
  console.log(report.textValidation.issues.slice(0, 10));
}
