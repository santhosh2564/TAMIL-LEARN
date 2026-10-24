import fs from 'fs';
import path from 'path';
import { Activity } from '../src/types';
import { AssetResolver } from '../src/engine/assets';

const ENG_DIR = path.resolve('src/content/class-3/english');
const PUBLIC_DIR = path.resolve('public');
const resolver = new AssetResolver();

const allActivities: Activity[] = [];
for (let m = 1; m <= 8; m++) {
  const f = path.join(ENG_DIR, `module-${m}`, 'activities.json');
  allActivities.push(...JSON.parse(fs.readFileSync(f, 'utf8')));
}

console.log('Total activities:', allActivities.length);

let pictureRecognitionCount = 0;
let promptMentionsPictureCount = 0;
let imagePropertyCount = 0;
let totalRequiringVisual = 0;

let resolvedCount = 0;
let missingFallbackCount = 0;
let diskNotFoundCount = 0;

const missingWords: string[] = [];

for (const act of allActivities) {
  const isPicRec = act.category === 'picture-recognition';
  const mentionsPic = /look at the picture|picture/i.test(act.prompt || '');
  const hasImgProp = Boolean(act.image?.source);

  if (isPicRec) pictureRecognitionCount++;
  if (mentionsPic) promptMentionsPictureCount++;
  if (hasImgProp) imagePropertyCount++;

  const requiresVisual = isPicRec || mentionsPic || hasImgProp;
  if (!requiresVisual) continue;

  totalRequiringVisual++;

  const semanticKey = act.targetWord
    ? `eng-${act.targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    : (act.source?.ewId ? `eng-${act.source.ewId.toLowerCase()}` : 'unknown');

  const assetId = act.image?.source || semanticKey;
  const res = resolver.resolve({ id: assetId, type: 'image' });

  if (res.status === 'resolved') {
    resolvedCount++;
    const diskPath = path.resolve(PUBLIC_DIR, res.asset.path.replace(/^\//, ''));
    if (!fs.existsSync(diskPath)) {
      diskNotFoundCount++;
      console.log(`Disk file missing: ${diskPath} for ${act.id} (${assetId})`);
    }
  } else {
    missingFallbackCount++;
    missingWords.push(`${act.id} (${act.targetWord}): ${assetId}`);
  }
}

console.log('=== English Visual Assets Audit ===');
console.log('picture-recognition category:', pictureRecognitionCount);
console.log('prompt mentions picture:', promptMentionsPictureCount);
console.log('image property present:', imagePropertyCount);
console.log('Total requiring visual/image component:', totalRequiringVisual);
console.log('Resolved to real images on disk:', resolvedCount);
console.log('Physical file missing from disk for resolved:', diskNotFoundCount);
console.log('Gracefully handled via missing-asset fallback:', missingFallbackCount);
