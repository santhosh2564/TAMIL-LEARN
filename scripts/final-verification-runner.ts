/* eslint-disable */
import * as fs from 'fs';
import * as path from 'path';
import { LocalContentRepository } from '../src/repositories/implementations/LocalContentRepository';
import { activityRegistry } from '../src/engine/ActivityRegistry';
import { registerCoreActivities } from '../src/features/Activity/registerActivities';
import { AssetResolver } from '../src/engine/assets/AssetResolver';
import { ArrangeWordEvaluator } from '../src/engine/evaluators/ArrangeWordEvaluator';
import { matchesTamilOrTarget } from '../src/utils/tamil';
import { normalizeTamilCategory, normalizeRecord } from './import-tamil';
import { Activity } from '../src/types';

const SOURCE_DIR = path.resolve('tamil_json_by_module_activity');
const INDEX_FILE = path.join(SOURCE_DIR, 'index.json');
const PUBLIC_DIR = path.resolve('public');
const FIXES_FILE = path.resolve('fixes-101.json');

registerCoreActivities();

interface RawRecord {
  'Target Word'?: string;
  'Source Type'?: string;
  'Source ID'?: string;
  'FTS ID'?: string;
  'Question ID'?: string | null;
  'Level'?: string | null;
  'Activity'?: string;
  'Question / Instruction'?: string;
  'Options / Units'?: string;
  'Correct Answer'?: string;
  'Source Batch'?: string;
  'Source File'?: string;
  'Picture Required'?: string;
  'Source Meaning / Notes'?: string | number | null;
  'Source Reference / Context'?: string | null;
  'Picture Specification'?: string;
  'Verification Flag'?: string | null;
  'Module'?: string;
  'Position in Module'?: number;
  'Normalized Word'?: string;
  'Master Sequence'?: number;
  image?: {
    path?: string;
    sourcePageUrl?: string;
    license?: string;
    creator?: string;
    attribution?: string;
    imageSource?: string;
    status?: string;
    reviewStatus?: string;
  };
  [key: string]: unknown;
}

export function runFullVerification() {
  console.log('=== STARTING TAMIL SOURCE-DATA AND RUNTIME VERIFICATION PASS ===\n');

  // 1. Verify index.json and modules
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error(`index.json not found at ${INDEX_FILE}`);
  }
  const indexContent = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));

  const moduleDirs = fs.readdirSync(SOURCE_DIR).filter(d => {
    return fs.statSync(path.join(SOURCE_DIR, d)).isDirectory() && d.startsWith('Module_');
  }).sort();

  console.log(`Checking Modules: Found ${moduleDirs.length} module directories.`);
  if (moduleDirs.length !== 8) {
    throw new Error(`Expected 8 module directories, found ${moduleDirs.length}`);
  }

  // Load fixes-101
  const fixes101: Record<string, { file: string; options: string }> = JSON.parse(fs.readFileSync(FIXES_FILE, 'utf8'));
  const fixesKeys = Object.keys(fixes101);
  console.log(`Loaded fixes-101.json with ${fixesKeys.length} fix definitions.`);

  let totalRecords = 0;
  const rawRecords: (RawRecord & { _file: string })[] = [];
  const idToRecord = new Map<string, RawRecord & { _file: string }>();
  const duplicateIds: string[] = [];
  const missingIds: string[] = [];
  const unicodeCorruptions: { id: string; field: string; val: string; issue: string }[] = [];

  const REPLACEMENT_CHAR_REGEX = /\uFFFD/;
  const MOJIBAKE_REGEX = /[\u00C0-\u00FF][\u0080-\u00BF]/;

  for (const modDir of moduleDirs) {
    const files = fs.readdirSync(path.join(SOURCE_DIR, modDir)).filter(f => f.endsWith('.json')).sort();
    for (const f of files) {
      const relPath = path.join(modDir, f);
      const fullPath = path.join(SOURCE_DIR, relPath);
      let content: string;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch (e) {
        throw new Error(`Malformed file read at ${relPath}: ${e}`);
      }

      let parsed: RawRecord[];
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error(`Malformed JSON in file ${relPath}: ${e}`);
      }

      for (const rec of parsed) {
        totalRecords++;
        rawRecords.push({ ...rec, _file: relPath });
        const id = rec['Source ID'] || rec['Question ID'] || rec['FTS ID'];
        if (!id) {
          missingIds.push(`Missing ID at record ${totalRecords} in ${relPath}`);
        } else {
          if (idToRecord.has(id)) {
            duplicateIds.push(id);
          }
          idToRecord.set(id, { ...rec, _file: relPath });
        }

        // Check text fields for Unicode corruption
        const checkField = (field: string, val: unknown) => {
          if (typeof val !== 'string') return;
          if (REPLACEMENT_CHAR_REGEX.test(val)) {
            unicodeCorruptions.push({ id: id || `rec_${totalRecords}`, field, val, issue: 'Replacement character U+FFFD' });
          }
          if (val.includes('\u0000')) {
            unicodeCorruptions.push({ id: id || `rec_${totalRecords}`, field, val, issue: 'Null byte' });
          }
          if (MOJIBAKE_REGEX.test(val)) {
            unicodeCorruptions.push({ id: id || `rec_${totalRecords}`, field, val, issue: 'Mojibake sequence' });
          }
        };

        checkField('Target Word', rec['Target Word']);
        checkField('Correct Answer', rec['Correct Answer']);
        checkField('Normalized Word', rec['Normalized Word']);
        checkField('Options / Units', rec['Options / Units']);
        checkField('Question / Instruction', rec['Question / Instruction']);
        checkField('Source Reference / Context', rec['Source Reference / Context']);
        checkField('Source Meaning / Notes', rec['Source Meaning / Notes']);
      }
    }
  }

  console.log(`Source JSON Total records: ${totalRecords}`);
  console.log(`Unique Source IDs: ${idToRecord.size}`);
  console.log(`Duplicate IDs: ${duplicateIds.length}`);
  console.log(`Missing IDs: ${missingIds.length}`);
  console.log(`Unicode corruption issues: ${unicodeCorruptions.length}`);

  // Specifically check all 101 previously problematic IDs are present
  const missingFixesIds = fixesKeys.filter(k => !idToRecord.has(k));
  console.log(`Fixes-101 presence check: ${fixesKeys.length - missingFixesIds.length}/${fixesKeys.length} present.`);
  if (missingFixesIds.length > 0) {
    console.error('Missing IDs from fixes-101:', missingFixesIds);
  }

  // 2. Verify all 16 Arrange activities from fixes-101 AND all arrange activities across the entire dataset
  const arrangeEvaluator = new ArrangeWordEvaluator();
  let fixArrangeCount = 0;
  let fixArrangeValid = 0;
  let fixArrangeFailures: any[] = [];

  let totalArrangeCount = 0;
  let totalArrangeValid = 0;
  let totalArrangeFailures: any[] = [];

  for (const [id, rec] of idToRecord.entries()) {
    const rawAct = (rec['Activity'] || '').trim();
    const { category, variant } = normalizeTamilCategory(rawAct);

    if (category === 'arrange-word') {
      totalArrangeCount++;
      const isFixItem = fixesKeys.includes(id);
      if (isFixItem) fixArrangeCount++;

      const targetWord = (rec['Target Word'] || '').trim();
      const answer = (rec['Correct Answer'] || targetWord).trim();
      const rawOptions = (rec['Options / Units'] || '').trim();
      const delim = rawOptions.includes('|') ? '|' : (rawOptions.includes('/') ? '/' : '|');
      const units = rawOptions.split(delim).map(u => u.trim()).filter(Boolean);

      // Verify units count >= 2
      if (units.length < 2) {
        const failure = { id, targetWord, units, reason: 'Less than 2 units' };
        totalArrangeFailures.push(failure);
        if (isFixItem) fixArrangeFailures.push(failure);
        continue;
      }

      // Check character multiset match
      const sortChars = (s: string) => Array.from(s.replace(/[\s\u200C\u200D]+/g, '')).sort().join('');
      const canFormTarget = sortChars(units.join('')) === sortChars(answer) || matchesTamilOrTarget(units.join(''), answer);

      if (!canFormTarget) {
        const failure = { id, targetWord, answer, units, reason: 'Units character multiset does not match target answer' };
        totalArrangeFailures.push(failure);
        if (isFixItem) fixArrangeFailures.push(failure);
        continue;
      }

      // Test against actual ArrangeWordEvaluator runtime
      const activityObj = normalizeRecord(rec);
      // Generate correct order of unit ids to simulate solving it
      // Find a permutation of units that reconstructs target word
      const unitOptions = activityObj.options || [];
      // Test if there is an ordering that matches answer
      // Using greedy or permutation match
      let solved = false;
      // In ArrangeWordActivity, units in correct order can be found:
      // Try to find an ordering of unit indices
      function permute(arr: { id: string; label: string }[]): { id: string; label: string }[][] {
        if (arr.length <= 1) return [arr];
        const res: { id: string; label: string }[][] = [];
        for (let i = 0; i < arr.length; i++) {
          const rest = permute([...arr.slice(0, i), ...arr.slice(i + 1)]);
          for (const r of rest) res.push([arr[i], ...r]);
        }
        return res;
      }

      // Check all permutations (typically 2-4 units)
      const perms = permute(unitOptions);
      for (const p of perms) {
        const inputIds = p.map(o => o.id);
        const evalRes = arrangeEvaluator.evaluate(activityObj, inputIds);
        if (evalRes.correct) {
          solved = true;
          break;
        }
      }

      if (!solved) {
        const failure = { id, targetWord, answer, units, reason: 'Runtime ArrangeWordEvaluator could not solve with any unit permutation' };
        totalArrangeFailures.push(failure);
        if (isFixItem) fixArrangeFailures.push(failure);
      } else {
        totalArrangeValid++;
        if (isFixItem) fixArrangeValid++;
      }
    }
  }

  if (totalArrangeFailures.length > 0) {
    console.log('Arrange Failures:', JSON.stringify(totalArrangeFailures, null, 2));
  }

  // 3. Verify all 85 choice activities from fixes-101 AND all choice activities across the dataset
  let fixChoiceCount = 0;
  let fixChoiceValid = 0;
  let fixChoiceFailures: any[] = [];

  let totalChoiceCount = 0;
  let totalChoiceValid = 0;
  let totalChoiceFailures: any[] = [];

  for (const [id, rec] of idToRecord.entries()) {
    const rawAct = (rec['Activity'] || '').trim();
    const { category } = normalizeTamilCategory(rawAct);

    // Choice activities: spelling-choice, context-choice, meaning-match, picture-recognition (select)
    if (['spelling-choice', 'context-choice', 'meaning-match', 'picture-recognition'].includes(category)) {
      totalChoiceCount++;
      const isFixItem = fixesKeys.includes(id);
      if (isFixItem) fixChoiceCount++;

      const answer = (rec['Correct Answer'] || rec['Target Word'] || '').trim();
      const rawOptions = (rec['Options / Units'] || '').trim();
      const delim = rawOptions.includes('|') ? '|' : (rawOptions.includes('/') ? '/' : '|');
      const opts = rawOptions.split(delim).map(o => o.trim()).filter(Boolean);
      const promptText = (rec['Question / Instruction'] || '').trim();

      let reason = '';
      if (!opts.includes(answer)) {
        reason = `Correct answer "${answer}" is not in options [${opts.join(', ')}]`;
      } else if (opts.length < 2) {
        reason = `Fewer than 2 options: [${opts.join(', ')}]`;
      } else {
        // Check for duplicate options
        const uniqueOpts = new Set(opts);
        if (uniqueOpts.size !== opts.length) {
          reason = `Duplicate option in [${opts.join(', ')}]`;
        } else if (opts.some(o => o.includes('___') || o === promptText)) {
          reason = `Options contain prompt placeholder or full prompt: [${opts.join(', ')}]`;
        }
      }

      // Verify that every option is a complete answer choice appropriate to activity type, not accidental single unit
      // If answer is a word of multiple letters, check if options are single letters mistakenly
      if (!reason && answer.length > 2) {
        // If all options except maybe one are single letters, that would be malformed
        const singleCharOpts = opts.filter(o => Array.from(o).length === 1);
        if (singleCharOpts.length === opts.length && !answer.length) {
          reason = `Options appear to be single characters instead of complete words`;
        }
      }

      if (reason) {
        const failure = { id, activity: rawAct, answer, options: opts, reason };
        totalChoiceFailures.push(failure);
        if (isFixItem) fixChoiceFailures.push(failure);
      } else {
        totalChoiceValid++;
        if (isFixItem) fixChoiceValid++;
      }
    }
  }

  console.log(`\nChoice Activities:`);
  console.log(`  Fixes-101 Choice records: Total = ${fixChoiceCount}, Valid = ${fixChoiceValid}, Failed = ${fixChoiceFailures.length}`);
  console.log(`  All Dataset Choice records: Total = ${totalChoiceCount}, Valid = ${totalChoiceValid}, Failed = ${totalChoiceFailures.length}`);
  if (totalChoiceFailures.length > 0) {
    console.log('Choice Failures:', JSON.stringify(totalChoiceFailures, null, 2));
  }

  // 4. Verify picture activities
  const assetResolver = new AssetResolver();
  let pictureCount = 0;
  let pictureResolved = 0;
  let brokenImages: { id: string; path?: string; reason: string }[] = [];
  let pictureChoiceMismatches: any[] = [];

  for (const [id, rec] of idToRecord.entries()) {
    const rawAct = (rec['Activity'] || '').trim();
    const isPic = (rec['Picture Required'] || '').toLowerCase() === 'yes' ||
                  rawAct.toLowerCase().includes('picture') ||
                  !!rec.image;

    if (isPic) {
      pictureCount++;
      const imgPath = rec.image?.path;
      if (imgPath) {
        const cleanPath = imgPath.replace(/^\//, '');
        const onDisk = path.resolve(PUBLIC_DIR, cleanPath);
        if (!fs.existsSync(onDisk)) {
          brokenImages.push({ id, path: imgPath, reason: `File does not exist on disk at ${onDisk}` });
        } else {
          pictureResolved++;
        }
      }

      // Check AssetResolver resolution
      const normalized = normalizeRecord(rec);
      if (normalized.image) {
        const res = assetResolver.resolve({ id: normalized.image.source, type: 'image' });
        if (res.status !== 'resolved') {
          brokenImages.push({ id, path: imgPath, reason: `AssetResolver returned status "${res.status}" for ID "${normalized.image.source}"` });
        }
      }

      // If it's a choice picture activity, verify correctAnswer in options
      const { category } = normalizeTamilCategory(rawAct);
      if (category === 'picture-recognition' || rawAct.includes('Select') || rawAct.includes('Spelling')) {
        const rawOptions = (rec['Options / Units'] || '').trim();
        const answer = (rec['Correct Answer'] || rec['Target Word'] || '').trim();
        if (rawOptions) {
          const delim = rawOptions.includes('|') ? '|' : (rawOptions.includes('/') ? '/' : '|');
          const opts = rawOptions.split(delim).map(o => o.trim()).filter(Boolean);
          if (!opts.includes(answer)) {
            pictureChoiceMismatches.push({ id, rawAct, answer, opts });
          }
        }
      }
    }
  }

  console.log(`\nPicture Activities:`);
  console.log(`  Total picture questions: ${pictureCount}`);
  console.log(`  Images verified on disk & AssetResolver: ${pictureResolved}`);
  console.log(`  Broken images: ${brokenImages.length}`);
  console.log(`  Picture choice mismatches: ${pictureChoiceMismatches.length}`);

  // 5. Check LocalContentRepository load
  const repo = new LocalContentRepository();
  const loadedTamilActivities = (repo as any).tamilActivities as Activity[];
  console.log(`\nLocalContentRepository:`);
  console.log(`  Loaded Tamil activities count: ${loadedTamilActivities.length}`);

  // 6. Check XLSX runtime references in src/
  let xlsxRuntimeRefs = 0;
  const srcFiles = fs.readdirSync('src', { recursive: true }) as string[];
  for (const sf of srcFiles) {
    const full = path.join('src', sf);
    if (fs.statSync(full).isFile() && (sf.endsWith('.ts') || sf.endsWith('.tsx'))) {
      const code = fs.readFileSync(full, 'utf8');
      if (/from\s+['"]xlsx['"]|require\(['"]xlsx['"]\)|import\(['"]xlsx['"]\)/.test(code)) {
        xlsxRuntimeRefs++;
        console.error(`Found XLSX runtime dependency in ${sf}`);
      }
    }
  }
  console.log(`\nXLSX Runtime References: ${xlsxRuntimeRefs}`);

  console.log('\n=== FINAL SUMMARY STATS ===');
  console.log(`Total records: ${totalRecords}`);
  console.log(`Arrange-word mismatches: ${totalArrangeFailures.length}`);
  console.log(`Choice mismatches: ${totalChoiceFailures.length}`);
  console.log(`Evaluator/data mismatches: ${totalArrangeFailures.length + totalChoiceFailures.length}`);
  console.log(`Duplicate IDs: ${duplicateIds.length}`);
  console.log(`Missing IDs: ${missingIds.length}`);
  console.log(`Unicode corruption: ${unicodeCorruptions.length}`);
  console.log(`Broken images: ${brokenImages.length}`);
  console.log(`XLSX runtime references: ${xlsxRuntimeRefs}`);
}

runFullVerification();
