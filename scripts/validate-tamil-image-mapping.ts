import * as fs from 'fs';
import * as path from 'path';
import { Activity } from '../src/types';
import { AssetManifest } from '../src/engine/assets/types';
import { AssetResolver } from '../src/engine/assets/AssetResolver';
import { extractSourceId } from '../src/engine/assets/sourceIdExtractor';

export interface TamilMappingValidationResult {
  totalActivities: number;
  totalPictureActivities: number;
  successfullyResolved: number;
  missing: string[];
  ambiguous: string[];
  mismatched: string[];
  oldReferencesRemaining: string[];
  brokenDiskFiles: string[];
  knownExceptionsAccounted: number;
  highProfileChecksPassed: boolean;
  passed: boolean;
}

const KNOWN_EXCEPTIONS = [
  'FTS0080', // ஆபரணம் - author explicitly noted "no picture generated yet"
  'FTS0903', // மெழுகு - known missing
  'FTS0500', // தலைமையாசிரியர் - text activity mistakenly marked Picture Required = Yes
  'FTS0552', // தேடல் - text activity mistakenly marked Picture Required = Yes
  'FTS0553', // தேடி - text activity mistakenly marked Picture Required = Yes
  'FTS0554'  // தேடு - text activity mistakenly marked Picture Required = Yes
];

export function validateTamilImageMapping(): TamilMappingValidationResult {
  console.log('====================================================');
  console.log('       TAMIL IMAGE MAPPING VALIDATION SUITE         ');
  console.log('====================================================\n');

  const activitiesPath = path.resolve('src/content/class-3/tamil/activities.json');
  const manifestPath = path.resolve('src/content/class-3/tamil/asset-manifest.json');

  if (!fs.existsSync(activitiesPath)) {
    throw new Error(`Activities file not found at: ${activitiesPath}`);
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Asset manifest file not found at: ${manifestPath}`);
  }

  const activities: Activity[] = JSON.parse(fs.readFileSync(activitiesPath, 'utf8'));
  const manifest: AssetManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const resolver = new AssetResolver(manifest);

  const missing: string[] = [];
  const ambiguous: string[] = [];
  const mismatched: string[] = [];
  const oldReferencesRemaining: string[] = [];
  const brokenDiskFiles: string[] = [];

  let pictureActivitiesCount = 0;
  let successfullyResolved = 0;

  for (const act of activities) {
    const isPictureActivity = act.needsImage === true || Boolean(act.image?.source);
    if (!isPictureActivity) {
      continue;
    }

    pictureActivitiesCount++;
    const sid = (act.source?.sourceId || act.source?.ftsId || act.source?.questionId || act.id)?.toUpperCase();

    // 1. Valid Source ID check
    if (!sid) {
      ambiguous.push(`${act.id}: Missing Source ID`);
      continue;
    }

    // 2. Check for old references
    const rawPath = act.metadata?.imageMeta?.path || '';
    if (rawPath.includes('/assets/class-3/tamil/images/')) {
      oldReferencesRemaining.push(`${act.id}: References old path ${rawPath}`);
    }

    // 3. Resolve using AssetResolver
    const assetId = act.image?.id || act.image?.source || `class3-tamil-picture-${sid.toLowerCase()}`;
    const res = resolver.resolve({ id: assetId, type: 'image' });

    if (res.status !== 'resolved' || !res.asset?.path) {
      missing.push(`${act.id} (${sid}): Failed resolution in AssetResolver (status: ${res.status})`);
      continue;
    }

    // 4. Source ID alignment check: resolved filename must contain the source ID
    const resolvedPath = res.asset.path;
    const resolvedFilename = path.basename(resolvedPath);
    const extractedId = extractSourceId(resolvedFilename);

    if (extractedId !== sid) {
      mismatched.push(`${act.id} (${sid}): Resolved to '${resolvedFilename}' with extracted ID '${extractedId}'`);
      continue;
    }

    // 5. Check physical file on disk
    const diskPath = path.resolve('public', resolvedPath.replace(/^\//, ''));
    if (!fs.existsSync(diskPath)) {
      brokenDiskFiles.push(`${act.id} (${sid}): Disk file missing at ${diskPath}`);
      continue;
    }

    const stat = fs.statSync(diskPath);
    if (stat.size === 0) {
      brokenDiskFiles.push(`${act.id} (${sid}): Empty (0 byte) file at ${diskPath}`);
      continue;
    }

    successfullyResolved++;
  }

  // 6. Verify Known Exceptions
  let knownExceptionsAccounted = 0;
  for (const excId of KNOWN_EXCEPTIONS) {
    const act = activities.find(a => a.id.toUpperCase() === excId);
    if (act && act.needsImage === false && !act.image) {
      knownExceptionsAccounted++;
    } else if (act) {
      console.warn(`Known exception ${excId} unexpectedly has needsImage=true or image set.`);
    }
  }

  // 7. Verify High-Profile Test Cases
  const highProfileExpected: Record<string, string> = {
    'FTS0014': 'Picture_04_FTS0014.jpg',
    'FTS0549': 'FTS0549.jpg',
    'FTS1039': 'FTS1039_Veliyoor.jpg',
    'Q001': 'Q001_Muyal.jpg'
  };

  let highProfileChecksPassed = true;
  for (const [sid, expectedFilename] of Object.entries(highProfileExpected)) {
    const act = activities.find(a => a.id.toUpperCase() === sid);
    if (!act) {
      console.error(`High profile test case ${sid} not found in activities!`);
      highProfileChecksPassed = false;
      continue;
    }
    const highId = act.image?.id || act.image?.source || `class3-tamil-picture-${sid.toLowerCase()}`;
    const res = resolver.resolve({ id: highId, type: 'image' });
    const actualFilename = path.basename(res.asset?.path || '');
    if (actualFilename !== expectedFilename) {
      console.error(`High profile mismatch for ${sid}: expected ${expectedFilename}, got ${actualFilename}`);
      highProfileChecksPassed = false;
    }
  }

  const passed =
    pictureActivitiesCount === 317 &&
    successfullyResolved === 317 &&
    missing.length === 0 &&
    ambiguous.length === 0 &&
    mismatched.length === 0 &&
    oldReferencesRemaining.length === 0 &&
    brokenDiskFiles.length === 0 &&
    knownExceptionsAccounted === KNOWN_EXCEPTIONS.length &&
    highProfileChecksPassed;

  console.log('--- VALIDATION SUMMARY REPORT ---');
  console.log(`Total Curriculum Activities:      ${activities.length}`);
  console.log(`Total Picture Activities:         ${pictureActivitiesCount}`);
  console.log(`Successfully Resolved:            ${successfullyResolved} / 317`);
  console.log(`Missing Image References:         ${missing.length}`);
  console.log(`Ambiguous Source IDs:             ${ambiguous.length}`);
  console.log(`Mismatched Source IDs:            ${mismatched.length}`);
  console.log(`Old Image References Remaining:   ${oldReferencesRemaining.length}`);
  console.log(`Broken / Missing Disk Files:      ${brokenDiskFiles.length}`);
  console.log(`Known Exceptions Accounted:       ${knownExceptionsAccounted} / ${KNOWN_EXCEPTIONS.length}`);
  console.log(`High-Profile Test Cases Passed:   ${highProfileChecksPassed ? 'YES' : 'NO'}`);
  console.log('----------------------------------------------------');
  console.log(`OVERALL STATUS:                   ${passed ? 'PASSED (100%)' : 'FAILED'}`);
  console.log('====================================================\n');

  if (!passed) {
    if (missing.length > 0) console.error('Missing:', missing);
    if (ambiguous.length > 0) console.error('Ambiguous:', ambiguous);
    if (mismatched.length > 0) console.error('Mismatched:', mismatched);
    if (oldReferencesRemaining.length > 0) console.error('Old References:', oldReferencesRemaining);
    if (brokenDiskFiles.length > 0) console.error('Broken Files:', brokenDiskFiles);
  }

  return {
    totalActivities: activities.length,
    totalPictureActivities: pictureActivitiesCount,
    successfullyResolved,
    missing,
    ambiguous,
    mismatched,
    oldReferencesRemaining,
    brokenDiskFiles,
    knownExceptionsAccounted,
    highProfileChecksPassed,
    passed
  };
}

// Execute if run from CLI
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/validate-tamil-image-mapping.ts');
if (isDirectRun) {
  const result = validateTamilImageMapping();
  if (!result.passed) {
    process.exit(1);
  }
}
