import * as fs from 'fs';
import * as path from 'path';

import { Activity } from '../src/types';
import { AssetResolver, AssetReference } from '../src/engine/assets';

const ACTIVITIES_FILE = path.resolve('src/content/class-3/tamil/term-1/activities.json');

function run() {
  const activitiesData = fs.readFileSync(ACTIVITIES_FILE, 'utf8');
  const activities: Activity[] = JSON.parse(activitiesData);
  const resolver = new AssetResolver();

  const stats = {
    checked: 0,
    requiringImages: 0,
    resolved: 0,
    missing: 0,
    invalid: 0,
    orphan: 0
  };

  const referencedAssetIds = new Set<string>();

  activities.forEach(activity => {
    stats.checked++;
    
    // Determine if activity needs an asset (picture-recognition or explicitly mapped picture activity like Q013)
    if (activity.category === 'picture-recognition' || activity.id === 'Q013') {
      stats.requiringImages++;
      const ref: AssetReference = {
        id: `class3-tamil-picture-${activity.id.toLowerCase()}`,
        type: 'image'
      };
      
      referencedAssetIds.add(ref.id);
      
      const resolution = resolver.resolve(ref);
      
      if (resolution.status === 'resolved') {
        const fullPath = path.resolve('public', resolution.asset.path.replace(/^\//, ''));
        if (!fs.existsSync(fullPath)) {
          console.error(`Missing file on disk for asset ${ref.id}: ${fullPath}`);
          stats.invalid++;
        } else {
          stats.resolved++;
        }
      }
      if (resolution.status === 'missing') stats.missing++;
      if (resolution.status === 'invalid') stats.invalid++;
    }
  });

  // Check for orphan assets
  // Load manifest directly to inspect its keys
  const MANIFEST_FILE = path.resolve('src/content/class-3/tamil/term-1/assets.json');
  if (fs.existsSync(MANIFEST_FILE)) {
    const manifestData = fs.readFileSync(MANIFEST_FILE, 'utf8');
    const manifest = JSON.parse(manifestData);
    
    for (const key of Object.keys(manifest)) {
      if (!referencedAssetIds.has(key)) {
        stats.orphan++;
      }
    }
  }

  console.log(`Content Asset Validation`);
  console.log(`------------------------`);
  console.log(`Activities checked: ${stats.checked}`);
  console.log(`Activities requiring images: ${stats.requiringImages}`);
  console.log(`Resolved: ${stats.resolved}`);
  console.log(`Missing: ${stats.missing}`);
  console.log(`Invalid: ${stats.invalid}`);
  console.log(`Orphan assets: ${stats.orphan}`);
  console.log(`------------------------`);

  // We do not fail the build if assets are missing, as that's a content gap, not a technical error.
  // We only fail if there are invalid configurations.
  if (stats.invalid > 0) {
    console.error(`Validation failed: Found ${stats.invalid} invalid asset references.`);
    process.exit(1);
  }
}

run();
