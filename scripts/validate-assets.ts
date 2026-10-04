import * as fs from 'fs';
import * as path from 'path';

import { Activity } from '../src/types';
import { AssetResolver, AssetReference } from '../src/engine/assets';

const TAMIL_ACTIVITIES_FILE = path.resolve('src/content/class-3/tamil/term-1/activities.json');
const TAMIL_MANIFEST_FILE = path.resolve('src/content/class-3/tamil/term-1/assets.json');

const ENG_DIR = path.resolve('src/content/class-3/english');
const ENG_ASSETS_FILE = path.join(ENG_DIR, 'assets.json');
const ENG_MANIFEST_FILE = path.join(ENG_DIR, 'asset-manifest.json');

function run() {
  const resolver = new AssetResolver();

  // 1. TAMIL ASSET VALIDATION
  const tamilActivities: Activity[] = JSON.parse(fs.readFileSync(TAMIL_ACTIVITIES_FILE, 'utf8'));
  const tamilStats = {
    checked: 0,
    requiringImages: 0,
    resolved: 0,
    missing: 0,
    invalid: 0,
    orphan: 0
  };

  const tamilReferencedAssetIds = new Set<string>();

  tamilActivities.forEach(activity => {
    tamilStats.checked++;
    
    if (activity.category === 'picture-recognition' || activity.id === 'Q013') {
      tamilStats.requiringImages++;
      const ref: AssetReference = {
        id: `class3-tamil-picture-${activity.id.toLowerCase()}`,
        type: 'image'
      };
      
      tamilReferencedAssetIds.add(ref.id);
      
      const resolution = resolver.resolve(ref);
      
      if (resolution.status === 'resolved') {
        const fullPath = path.resolve('public', resolution.asset.path.replace(/^\//, ''));
        if (!fs.existsSync(fullPath)) {
          console.error(`Missing file on disk for Tamil asset ${ref.id}: ${fullPath}`);
          tamilStats.invalid++;
        } else {
          tamilStats.resolved++;
        }
      }
      if (resolution.status === 'missing') tamilStats.missing++;
      if (resolution.status === 'invalid') tamilStats.invalid++;
    }
  });

  if (fs.existsSync(TAMIL_MANIFEST_FILE)) {
    const manifest = JSON.parse(fs.readFileSync(TAMIL_MANIFEST_FILE, 'utf8'));
    for (const key of Object.keys(manifest)) {
      if (!tamilReferencedAssetIds.has(key)) {
        tamilStats.orphan++;
      }
    }
  }

  console.log(`========================================`);
  console.log(`Tamil Asset Validation`);
  console.log(`----------------------------------------`);
  console.log(`Activities checked: ${tamilStats.checked}`);
  console.log(`Activities requiring images: ${tamilStats.requiringImages}`);
  console.log(`Resolved: ${tamilStats.resolved}`);
  console.log(`Missing: ${tamilStats.missing}`);
  console.log(`Invalid: ${tamilStats.invalid}`);
  console.log(`Orphan assets: ${tamilStats.orphan}`);
  console.log(`----------------------------------------`);

  // 2. ENGLISH ASSET VALIDATION
  const engActivities: Activity[] = [];
  for (let m = 1; m <= 8; m++) {
    const actFile = path.join(ENG_DIR, `module-${m}`, 'activities.json');
    if (fs.existsSync(actFile)) {
      engActivities.push(...JSON.parse(fs.readFileSync(actFile, 'utf8')));
    }
  }

  const engCataloged: {
    activityId: string;
    ewId: string;
    targetWord: string;
    activityCode: string;
    assetId: string;
    required: boolean;
    classification: 'REQUIRED' | 'TEXT_ONLY';
    status: 'mapped' | 'missing' | 'text_only';
    prompt: string;
    proposedPath?: string;
    reusedFromTamilAssetId?: string;
  }[] = fs.existsSync(ENG_ASSETS_FILE) ? JSON.parse(fs.readFileSync(ENG_ASSETS_FILE, 'utf8')) : [];

  const engStats = {
    checked: engActivities.length,
    catalogedRequirements: engCataloged.length,
    genuinelyRequired: 0,
    textOnly: 0,
    resolvedMapped: 0,
    missingDocumented: 0,
    invalid: 0,
    orphanInManifest: 0
  };

  const engReferencedKeys = new Set<string>();

  for (const item of engCataloged) {
    if (item.classification === 'REQUIRED') {
      engStats.genuinelyRequired++;
      engReferencedKeys.add(item.assetId);

      // Verify asset reference resolution
      const ref: AssetReference = { id: item.assetId, type: 'image' };
      const resolution = resolver.resolve(ref);

      if (item.status === 'mapped') {
        if (resolution.status !== 'resolved') {
          console.error(`Expected mapped asset ${item.assetId} to resolve, got ${resolution.status}`);
          engStats.invalid++;
        } else {
          const fullPath = path.resolve('public', resolution.asset.path.replace(/^\//, ''));
          if (!fs.existsSync(fullPath)) {
            console.error(`Missing file on disk for mapped English asset ${item.assetId}: ${fullPath}`);
            engStats.invalid++;
          } else {
            engStats.resolvedMapped++;
          }
        }
      } else if (item.status === 'missing') {
        if (resolution.status === 'invalid') {
          console.error(`Asset ${item.assetId} returned invalid resolution: ${resolution}`);
          engStats.invalid++;
        } else {
          engStats.missingDocumented++;
        }
      }
    } else if (item.classification === 'TEXT_ONLY') {
      engStats.textOnly++;
    }
  }

  // Check English resolved manifest for orphan entries
  if (fs.existsSync(ENG_MANIFEST_FILE)) {
    const engManifest = JSON.parse(fs.readFileSync(ENG_MANIFEST_FILE, 'utf8'));
    for (const key of Object.keys(engManifest)) {
      if (!engReferencedKeys.has(key)) {
        console.warn(`Orphan entry in English asset-manifest.json: ${key}`);
        engStats.orphanInManifest++;
      }
    }
  }

  console.log(`\nEnglish Asset Validation`);
  console.log(`----------------------------------------`);
  console.log(`Total English Activities: ${engStats.checked}`);
  console.log(`Cataloged Requirements: ${engStats.catalogedRequirements}`);
  console.log(`Genuinely REQUIRED: ${engStats.genuinelyRequired}`);
  console.log(`TEXT_ONLY (False Positives): ${engStats.textOnly}`);
  console.log(`Resolved (Reused from Tamil): ${engStats.resolvedMapped}`);
  console.log(`Missing (Genuinely Required, Unacquired): ${engStats.missingDocumented}`);
  console.log(`Invalid: ${engStats.invalid}`);
  console.log(`Orphan in Manifest: ${engStats.orphanInManifest}`);
  console.log(`========================================\n`);

  if (tamilStats.invalid > 0 || engStats.invalid > 0) {
    console.error(`Validation failed: Found ${tamilStats.invalid + engStats.invalid} invalid asset references.`);
    process.exit(1);
  }
}

run();
