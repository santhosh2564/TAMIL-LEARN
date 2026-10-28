import * as fs from 'fs';
import * as path from 'path';
import { Activity } from '../src/types';
import { AssetManifest } from '../src/engine/assets/types';

const ACTIVITIES_FILE = path.resolve('src/content/class-3/tamil/activities.json');
const MANIFEST_FILE = path.resolve('src/content/class-3/tamil/asset-manifest.json');
const MODULES_DIR = path.resolve('src/content/class-3/tamil');

const KNOWN_EXCEPTIONS = new Set([
  'FTS0080', // ஆபரணம் - author explicitly noted "no picture generated yet"
  'FTS0903', // மெழுகு - known missing
  'FTS0500', // தலைமையாசிரியர் - text activity mistakenly marked Picture Required = Yes
  'FTS0552', // தேடல் - text activity mistakenly marked Picture Required = Yes
  'FTS0553', // தேடி - text activity mistakenly marked Picture Required = Yes
  'FTS0554'  // தேடு - text activity mistakenly marked Picture Required = Yes
]);

export function syncTamilPictureActivities() {
  console.log('=== Synchronizing Tamil Picture Activities ===');

  const activities: Activity[] = JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf8'));
  const manifest: AssetManifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));

  let pictureCount = 0;
  let textCount = 0;
  let exceptionCount = 0;

  for (const act of activities) {
    const sid = act.id.toUpperCase();
    const orig = act.source?.originalActivity || '';
    const key = `class3-tamil-picture-${sid.toLowerCase()}`;
    const manifestEntry = manifest[key];

    const isPictureActivity =
      !KNOWN_EXCEPTIONS.has(sid) &&
      Boolean(manifestEntry) &&
      (orig.includes('Picture') || (sid.startsWith('FTS') && Boolean(manifestEntry)));

    if (isPictureActivity) {
      pictureCount++;
      act.needsImage = true;
      act.image = {
        id: key,
        type: 'image',
        source: key,
        alt: act.targetWord
      };
      if (!act.metadata) {
        act.metadata = {};
      }
      act.metadata.imageMeta = {
        path: manifestEntry.path
      };
    } else {
      if (KNOWN_EXCEPTIONS.has(sid)) {
        exceptionCount++;
      } else {
        textCount++;
      }
      act.needsImage = false;
      delete act.image;
    }
  }

  console.log(`Updated activities: ${pictureCount} picture-based, ${textCount} text-only, ${exceptionCount} known exceptions.`);

  // Write master activities.json
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2), 'utf8');

  // Partition into module files
  for (let m = 1; m <= 8; m++) {
    const modActs = activities.filter((a: Activity) => a.module === m);
    const modDir = path.join(MODULES_DIR, `module-${m}`);
    if (!fs.existsSync(modDir)) {
      fs.mkdirSync(modDir, { recursive: true });
    }
    const modFile = path.join(modDir, 'activities.json');
    fs.writeFileSync(modFile, JSON.stringify(modActs, null, 2), 'utf8');
    console.log(`Module ${m}: wrote ${modActs.length} activities (${modActs.filter((a: Activity) => a.needsImage).length} with pictures).`);
  }

  return { pictureCount, textCount, exceptionCount, total: activities.length };
}

// Execute if run from CLI
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/sync-tamil-picture-activities.ts');
if (isDirectRun) {
  syncTamilPictureActivities();
}
