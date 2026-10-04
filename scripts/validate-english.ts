import * as fs from 'fs';
import * as path from 'path';
// @ts-expect-error - no types for xlsx
import * as xlsx from 'xlsx';
import { Activity, EnglishCurriculumManifest, EnglishModuleManifest } from '../src/types';

const ENG_DIR = path.resolve('src/content/class-3/english');
const MASTER_FILE = path.resolve('docs/eng/EW001_EW958_FINAL_CONSOLIDATED_VERIFIED_MASTER.xlsx');

export interface EnglishValidationResult {
  valid: boolean;
  totalUniqueWords: number;
  totalReviewInstances: number;
  totalActivities: number;
  errors: string[];
  warnings: string[];
}

export function validateEnglishContent(): EnglishValidationResult {
  const result: EnglishValidationResult = {
    valid: true,
    totalUniqueWords: 0,
    totalReviewInstances: 0,
    totalActivities: 0,
    errors: [],
    warnings: []
  };

  const pushError = (msg: string) => {
    result.errors.push(msg);
    result.valid = false;
  };

  // --- CHECK A: MASTER WORKBOOK ---
  console.log('[Check A] Validating Master Question Bank...');
  if (!fs.existsSync(MASTER_FILE)) {
    pushError(`Master file not found at ${MASTER_FILE}`);
    return result;
  }

  const masterBuf = fs.readFileSync(MASTER_FILE);
  const masterWb = xlsx.read(masterBuf, { type: 'buffer' });
  const masterSheet = masterWb.Sheets['EW001-EW958 Consolidated'];
  if (!masterSheet) {
    pushError('Master sheet "EW001-EW958 Consolidated" not found');
    return result;
  }

  const masterRows: Record<string, unknown>[] = xlsx.utils.sheet_to_json(masterSheet);
  const masterMap = new Map<string, Record<string, unknown>>();

  masterRows.forEach((r, idx) => {
    const id = String(r['ID'] || r['EW ID'] || '').trim();
    if (!id) {
      pushError(`Master row ${idx + 2} has empty ID`);
      return;
    }
    if (masterMap.has(id)) {
      pushError(`Duplicate ID in Master: ${id} at row ${idx + 2}`);
    }
    masterMap.set(id, r);
  });

  if (masterMap.size !== 958) {
    pushError(`Master unique ID count expected 958, got ${masterMap.size}`);
  }

  for (let i = 1; i <= 958; i++) {
    const expectedId = `EW${String(i).padStart(3, '0')}`;
    if (!masterMap.has(expectedId)) {
      pushError(`Master missing expected ID: ${expectedId}`);
    }
  }

  // --- CHECK B & C & D & E & F: NORMALIZED RUNTIME CONTENT ---
  console.log('[Check B - F] Validating Normalized JSON Content...');
  const manifestPath = path.join(ENG_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    pushError(`Consolidated manifest not found at ${manifestPath}`);
    return result;
  }

  const curriculumManifest: EnglishCurriculumManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (curriculumManifest.subject !== 'English') {
    pushError(`Curriculum manifest subject expected "English", got "${curriculumManifest.subject}"`);
  }
  if (curriculumManifest.classLevel !== 3) {
    pushError(`Curriculum manifest classLevel expected 3, got ${curriculumManifest.classLevel}`);
  }

  const allRuntimeIds = new Set<string>();
  const moduleNewWordIds = new Map<number, Set<string>>();
  const allNewWordIds = new Set<string>();
  const allReviewWordIds = new Set<string>();

  let totalNew = 0;
  let totalReview = 0;

  for (let m = 1; m <= 8; m++) {
    const modDir = path.join(ENG_DIR, `module-${m}`);
    const actFile = path.join(modDir, 'activities.json');
    const modManifestFile = path.join(modDir, 'manifest.json');

    if (!fs.existsSync(actFile)) {
      pushError(`Module ${m} activities.json not found at ${actFile}`);
      continue;
    }
    if (!fs.existsSync(modManifestFile)) {
      pushError(`Module ${m} manifest.json not found at ${modManifestFile}`);
      continue;
    }

    const activities: Activity[] = JSON.parse(fs.readFileSync(actFile, 'utf-8'));
    const modManifest: EnglishModuleManifest = JSON.parse(fs.readFileSync(modManifestFile, 'utf-8'));

    const modNewSet = new Set<string>();
    const modRevSet = new Set<string>();
    moduleNewWordIds.set(m, modNewSet);

    // Expected module counts
    const expectedNew = m === 8 ? 118 : 120;
    const expectedRev = m === 1 ? 0 : 40;
    const expectedTotal = expectedNew + expectedRev;

    if (activities.length !== expectedTotal) {
      pushError(`Module ${m} activities count expected ${expectedTotal}, got ${activities.length}`);
    }
    if (modManifest.newWordCount !== expectedNew) {
      pushError(`Module ${m} manifest newWordCount expected ${expectedNew}, got ${modManifest.newWordCount}`);
    }
    if (modManifest.reviewWordCount !== expectedRev) {
      pushError(`Module ${m} manifest reviewWordCount expected ${expectedRev}, got ${modManifest.reviewWordCount}`);
    }

    activities.forEach(act => {
      // Check F: Runtime ID uniqueness
      if (allRuntimeIds.has(act.id)) {
        pushError(`Duplicate runtime ID across curriculum: ${act.id}`);
      }
      allRuntimeIds.add(act.id);

      // Check D: Required schema fields
      if (!act.id) pushError(`Activity missing id in module ${m}`);
      if (act.classLevel !== 3) pushError(`Activity ${act.id} classLevel is not 3`);
      if (act.subject !== 'English') pushError(`Activity ${act.id} subject is not English`);
      if (act.language !== 'en-IN') pushError(`Activity ${act.id} language is not en-IN`);
      if (act.module !== m) pushError(`Activity ${act.id} module mismatch: expected ${m}, got ${act.module}`);
      if (typeof act.day !== 'number' || act.day < 1 || act.day > 5) {
        pushError(`Activity ${act.id} has invalid day: ${act.day}`);
      }
      if (act.role !== 'new' && act.role !== 'review') {
        pushError(`Activity ${act.id} has invalid role: ${act.role}`);
      }
      if (!act.prompt) pushError(`Activity ${act.id} has empty prompt`);
      if (!act.correctAnswer) pushError(`Activity ${act.id} has empty correctAnswer`);
      if (!act.targetWord) pushError(`Activity ${act.id} has empty targetWord`);
      if (!act.category) pushError(`Activity ${act.id} has empty category`);
      if (!act.variant) pushError(`Activity ${act.id} has empty variant`);
      if (![1, 2, 3].includes(act.level)) pushError(`Activity ${act.id} has invalid level: ${act.level}`);

      // Check E: Source traceability
      if (!act.source) {
        pushError(`Activity ${act.id} is missing source tracking`);
      } else {
        if (!act.source.workbook) pushError(`Activity ${act.id} is missing source.workbook`);
        if (!act.source.ewId) pushError(`Activity ${act.id} is missing source.ewId`);
        if (!act.source.activityCode) pushError(`Activity ${act.id} is missing source.activityCode`);
        if (!act.source.originalActivity) pushError(`Activity ${act.id} is missing source.originalActivity`);
      }

      const ewId = act.source?.ewId || '';

      // Check existence in Master
      const masterRow = masterMap.get(ewId);
      if (!masterRow) {
        pushError(`Activity ${act.id} references ewId ${ewId} which does not exist in Master`);
      } else {
        // Compare answer with Master
        const masterAns = String(masterRow['Answer'] || '').trim().toLowerCase();
        const actAns = String(act.correctAnswer || '').trim().toLowerCase();
        if (masterAns !== actAns) {
          pushError(`Activity ${act.id} answer "${act.correctAnswer}" != Master answer "${masterRow['Answer']}"`);
        }
      }

      if (act.role === 'new') {
        totalNew++;
        if (modNewSet.has(ewId)) {
          pushError(`Duplicate new word in Module ${m}: ${ewId}`);
        }
        modNewSet.add(ewId);

        // Check B: Zero overlap between module new-word sets
        if (allNewWordIds.has(ewId)) {
          pushError(`New word ${ewId} in Module ${m} overlaps with previous module`);
        }
        allNewWordIds.add(ewId);
      } else {
        // Review record
        totalReview++;
        if (modRevSet.has(ewId)) {
          pushError(`Duplicate review word in Module ${m}: ${ewId}`);
        }
        modRevSet.add(ewId);
        allReviewWordIds.add(ewId);

        // Review words must not be new words in the SAME module
        if (modNewSet.has(ewId)) {
          pushError(`Review word ${ewId} in Module ${m} collides with new word in same module`);
        }

        // Review source module check
        if (!act.reviewSourceModule || act.reviewSourceModule >= m) {
          pushError(`Review activity ${act.id} has invalid reviewSourceModule: ${act.reviewSourceModule} (current: ${m})`);
        }
      }

      // Check Options / Units parsing consistency
      if (act.variant === 'select') {
        if (!act.options || act.options.length < 2) {
          pushError(`Select activity ${act.id} has insufficient options (${act.options?.length})`);
        }
      } else if (act.variant === 'arrange') {
        if (!act.units || act.units.length < 2) {
          pushError(`Arrange activity ${act.id} has insufficient units (${act.units?.length})`);
        }
      }
    });
  }

  result.totalUniqueWords = allNewWordIds.size;
  result.totalReviewInstances = totalReview;
  result.totalActivities = allRuntimeIds.size;

  // Master bijection checks
  if (totalNew !== 958) {
    pushError(`Total new word activities expected 958, got ${totalNew}`);
  }
  if (allNewWordIds.size !== 958) {
    pushError(`Total unique new words across all modules expected 958, got ${allNewWordIds.size}`);
  }
  if (totalReview !== 280) {
    pushError(`Total review instances across all modules expected 280, got ${totalReview}`);
  }
  if (allRuntimeIds.size !== 1238) {
    pushError(`Total scheduled runtime activities expected 1238, got ${allRuntimeIds.size}`);
  }

  // --- CHECK G: ASSET REQUIREMENTS MANIFEST & RESOLVED MANIFEST ---
  console.log('[Check G] Validating English Asset Requirements & Manifest...');
  const assetManifestPath = path.join(ENG_DIR, 'assets.json');
  if (!fs.existsSync(assetManifestPath)) {
    pushError(`English assets.json not found at ${assetManifestPath}`);
  } else {
    const assets: Record<string, unknown>[] = JSON.parse(fs.readFileSync(assetManifestPath, 'utf-8'));
    if (assets.length !== 343) {
      pushError(`English assets.json item count expected 343, got ${assets.length}`);
    } else {
      console.log(`English asset requirements cataloged: ${assets.length} items`);
    }

    let mappedCount = 0;
    let missingCount = 0;
    let textOnlyCount = 0;

    for (const a of assets) {
      const assetId = String(a.assetId || '');
      if (!assetId.startsWith('eng-')) {
        pushError(`Asset ID ${assetId} must start with "eng-"`);
      }
      const status = String(a.status || '');
      if (status === 'mapped') mappedCount++;
      else if (status === 'missing') missingCount++;
      else if (status === 'text_only') textOnlyCount++;
      else pushError(`Invalid status "${status}" for activity ${a.activityId}`);
    }

    if (mappedCount !== 335) pushError(`Expected 335 mapped assets, got ${mappedCount}`);
    if (missingCount !== 0) pushError(`Expected 0 missing assets, got ${missingCount}`);
    if (textOnlyCount !== 8) pushError(`Expected 8 text_only assets, got ${textOnlyCount}`);
  }

  const resolvedManifestPath = path.join(ENG_DIR, 'asset-manifest.json');
  if (!fs.existsSync(resolvedManifestPath)) {
    pushError(`English asset-manifest.json not found at ${resolvedManifestPath}`);
  } else {
    const manifest = JSON.parse(fs.readFileSync(resolvedManifestPath, 'utf-8'));
    const keys = Object.keys(manifest);
    if (keys.length !== 255) {
      pushError(`Expected 255 resolved assets in asset-manifest.json, got ${keys.length}`);
    }
    for (const [key, entry] of Object.entries(manifest)) {
      const item = entry as { type: string; source: string; path: string };
      const localFile = path.resolve('public', item.path.replace(/^\//, ''));
      if (!fs.existsSync(localFile)) {
        pushError(`Manifest asset ${key} points to non-existent file on disk: ${localFile}`);
      }
    }
  }

  // Check documented anomalies preservation
  const anomalyIds = ['EW114', 'EW249', 'EW262', 'EW265', 'EW574', 'EW576', 'EW894', 'EW913', 'EW943'];
  for (const anomId of anomalyIds) {
    let foundAnomaly = false;
    for (let m = 1; m <= 8; m++) {
      const actFile = path.join(ENG_DIR, `module-${m}`, 'activities.json');
      if (!fs.existsSync(actFile)) continue;
      const acts: Activity[] = JSON.parse(fs.readFileSync(actFile, 'utf-8'));
      const match = acts.find(a => a.source?.ewId === anomId && a.role === 'new');
      if (match) {
        if (!match.source?.hasSourceAnomaly || !match.source?.anomalyNote) {
          pushError(`Anomaly word ${anomId} does not have hasSourceAnomaly/anomalyNote set`);
        } else {
          foundAnomaly = true;
        }
      }
    }
    if (!foundAnomaly) {
      pushError(`Anomaly word ${anomId} not found among new words`);
    }
  }

  return result;
}

// Run CLI when invoked directly
if (process.argv[1] && (process.argv[1].endsWith('validate-english.ts') || process.argv[1].endsWith('validate-english.js'))) {
  const result = validateEnglishContent();
  console.log('\n========================================');
  console.log(`Validation Result: ${result.valid ? 'PASS' : 'FAIL'}`);
  console.log(`Total Unique Words: ${result.totalUniqueWords}`);
  console.log(`Total Review Instances: ${result.totalReviewInstances}`);
  console.log(`Total Runtime Activities: ${result.totalActivities}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log('========================================\n');

  if (result.errors.length > 0) {
    console.error('ERRORS:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}
