import * as fs from 'fs';
import * as path from 'path';

const activitiesPath = path.resolve('src/content/class-3/tamil/term-1/activities.json');
const assetsPath = path.resolve('src/content/class-3/tamil/term-1/assets.json');
const imagesDir = path.resolve('Tamil spelling images');

const activities = JSON.parse(fs.readFileSync(activitiesPath, 'utf8'));
const assets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));

// Map activities by ID: Q001 -> activity
const actMap = new Map<string, Record<string, unknown>>();
const actByNum = new Map<number, Record<string, unknown>>();
for (const act of activities) {
  actMap.set(act.id, act);
  const num = parseInt(act.id.replace(/\D/g, ''), 10);
  actByNum.set(num, act);
}

// Read all supplied images
interface ImageInfo {
  filename: string;
  folder: string;
  fullPath: string;
  ftsId: string;
  ftsNum: number;
}

const suppliedImages: ImageInfo[] = [];

function walk(dir: string) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(full);
    } else if (item.isFile() && item.name.toLowerCase().endsWith('.jpg')) {
      const match = item.name.match(/FTS(\d+)/i);
      if (match) {
        suppliedImages.push({
          filename: item.name,
          folder: path.basename(dir),
          fullPath: full,
          ftsId: `FTS${match[1]}`,
          ftsNum: parseInt(match[1], 10)
        });
      } else {
        console.warn('Non-FTS image:', item.name);
      }
    }
  }
}

walk(imagesDir);

console.log(`Total supplied images: ${suppliedImages.length}`);

// Compare ftsNum with activity IDs (1..144)
let matchedWithActivity = 0;
let matchedWithPictureActivity = 0;
let matchedWithNonPictureActivity = 0;
let unmatchedBeyond144 = 0;

const matchedList: Array<{
  ftsId: string;
  filename: string;
  folder: string;
  activityId: string;
  targetWord: string;
  category: string;
  variant: string;
  prompt: string;
  currentAssetInManifest?: string;
}> = [];

const unmatchedList: ImageInfo[] = [];

for (const img of suppliedImages) {
  const act = actByNum.get(img.ftsNum);
  if (act) {
    matchedWithActivity++;
    const assetKey = `class3-tamil-picture-${act.id.toLowerCase()}`;
    const currAsset = assets[assetKey];
    if (act.category === 'picture-recognition' || currAsset) {
      matchedWithPictureActivity++;
    } else {
      matchedWithNonPictureActivity++;
    }
    matchedList.push({
      ftsId: img.ftsId,
      filename: img.filename,
      folder: img.folder,
      activityId: act.id,
      targetWord: act.targetWord,
      category: act.category,
      variant: act.variant,
      prompt: act.prompt,
      currentAssetInManifest: currAsset ? currAsset.path : undefined
    });
  } else {
    unmatchedBeyond144++;
    unmatchedList.push(img);
  }
}

console.log(`Matched with Class 3 Term 1 Activities (1-144): ${matchedWithActivity}`);
console.log(`  - Matched with picture-recognition or currently manifested activities: ${matchedWithPictureActivity}`);
console.log(`  - Matched with other activities in Term 1: ${matchedWithNonPictureActivity}`);
console.log(`Unmatched (FTS number > 144 or no corresponding activity in Term 1): ${unmatchedBeyond144}`);

console.log('\n--- FIRST 25 MATCHED ---');
for (const m of matchedList.slice(0, 25)) {
  console.log(`${m.ftsId} (${m.filename}) -> ${m.activityId} [${m.targetWord}] (cat: ${m.category}, var: ${m.variant}) | current: ${m.currentAssetInManifest || 'none'}`);
}

console.log('\n--- SAMPLES OF UNMATCHED (ftsNum > 144) ---');
for (const u of unmatchedList.slice(0, 15)) {
  console.log(`${u.ftsId} (${u.filename}) in ${u.folder} (num: ${u.ftsNum})`);
}
console.log(`Max FTS num in unmatched: ${Math.max(...unmatchedList.map(u => u.ftsNum))}`);
console.log(`Min FTS num in unmatched: ${Math.min(...unmatchedList.map(u => u.ftsNum))}`);
