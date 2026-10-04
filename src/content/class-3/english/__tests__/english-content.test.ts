import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Activity, EnglishCurriculumManifest, EnglishModuleManifest } from '../../../../types';

const ENG_DIR = path.resolve('src/content/class-3/english');

describe('Class 3 English Content Normalization & Ingestion', () => {
  const manifestPath = path.join(ENG_DIR, 'manifest.json');
  expect(fs.existsSync(manifestPath)).toBe(true);

  const curriculumManifest: EnglishCurriculumManifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8')
  );

  const moduleActivities: Record<number, Activity[]> = {};
  const moduleManifests: Record<number, EnglishModuleManifest> = {};

  for (let m = 1; m <= 8; m++) {
    const actFile = path.join(ENG_DIR, `module-${m}`, 'activities.json');
    const manFile = path.join(ENG_DIR, `module-${m}`, 'manifest.json');
    moduleActivities[m] = JSON.parse(fs.readFileSync(actFile, 'utf-8'));
    moduleManifests[m] = JSON.parse(fs.readFileSync(manFile, 'utf-8'));
  }

  const allActivities = Object.values(moduleActivities).flat();
  const newActivities = allActivities.filter(a => a.role === 'new');
  const reviewActivities = allActivities.filter(a => a.role === 'review');

  it('contains exactly 958 unique new vocabulary words and 280 review instances (1238 total)', () => {
    expect(curriculumManifest.totalUniqueWords).toBe(958);
    expect(curriculumManifest.totalReviewInstances).toBe(280);
    expect(curriculumManifest.totalActivities).toBe(1238);
    expect(curriculumManifest.moduleCount).toBe(8);

    expect(newActivities.length).toBe(958);
    expect(reviewActivities.length).toBe(280);
    expect(allActivities.length).toBe(1238);

    const uniqueNewEwIds = new Set(newActivities.map(a => a.source.ewId));
    expect(uniqueNewEwIds.size).toBe(958);
  });

  it('guarantees zero duplicate runtime IDs across the entire curriculum', () => {
    const runtimeIds = allActivities.map(a => a.id);
    const uniqueIds = new Set(runtimeIds);
    expect(uniqueIds.size).toBe(allActivities.length);
    expect(uniqueIds.size).toBe(1238);
  });

  it('verifies exact module activity counts and manifest definitions', () => {
    // Module 1: 120 new, 0 review = 120 total
    expect(moduleActivities[1].length).toBe(120);
    expect(moduleManifests[1].newWordCount).toBe(120);
    expect(moduleManifests[1].reviewWordCount).toBe(0);
    expect(moduleManifests[1].totalActivities).toBe(120);

    // Modules 2–7: 120 new + 40 review = 160 total each
    for (let m = 2; m <= 7; m++) {
      expect(moduleActivities[m].length).toBe(160);
      expect(moduleManifests[m].newWordCount).toBe(120);
      expect(moduleManifests[m].reviewWordCount).toBe(40);
      expect(moduleManifests[m].totalActivities).toBe(160);
    }

    // Module 8: 118 new + 40 review = 158 total
    expect(moduleActivities[8].length).toBe(158);
    expect(moduleManifests[8].newWordCount).toBe(118);
    expect(moduleManifests[8].reviewWordCount).toBe(40);
    expect(moduleManifests[8].totalActivities).toBe(158);
  });

  it('verifies that module new-word sets have zero overlap (disjoint)', () => {
    const seen = new Set<string>();
    for (let m = 1; m <= 8; m++) {
      const modNew = moduleActivities[m].filter(a => a.role === 'new');
      for (const act of modNew) {
        const ewId = act.source.ewId!;
        expect(seen.has(ewId)).toBe(false);
        seen.add(ewId);
      }
    }
    expect(seen.size).toBe(958);
  });

  it('verifies that review words strictly originate from earlier modules', () => {
    for (let m = 2; m <= 8; m++) {
      const modReviews = moduleActivities[m].filter(a => a.role === 'review');
      expect(modReviews.length).toBe(40);
      for (const act of modReviews) {
        expect(act.reviewSourceModule).toBeDefined();
        expect(act.reviewSourceModule!).toBeLessThan(m);
        expect(act.reviewSourceModule!).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('verifies activity code mappings to categories and variants', () => {
    for (const act of allActivities) {
      const code = act.source.activityCode;
      switch (code) {
        case 'E08':
          expect(act.category).toBe('spelling-choice');
          expect(act.variant).toBe('select');
          expect(act.options).toBeDefined();
          expect(act.options!.length).toBeGreaterThanOrEqual(2);
          break;
        case 'E06':
        case 'E04':
        case 'E07':
          expect(act.category).toBe('arrange-word');
          expect(act.variant).toBe('arrange');
          expect(act.units).toBeDefined();
          expect(act.units!.length).toBeGreaterThanOrEqual(2);
          break;
        case 'E05':
        case 'E11':
          expect(act.category).toBe('word-completion');
          expect(act.variant).toBe('missing-unit');
          break;
        case 'E01':
          expect(act.category).toBe('picture-recognition');
          expect(act.variant).toBe('word-entry');
          break;
        case 'E12':
          expect(act.category).toBe('picture-recognition');
          expect(['select', 'word-entry']).toContain(act.variant);
          break;
        case 'E09':
          expect(act.category).toBe('meaning-match');
          expect(act.variant).toBe('word-entry');
          break;
      }
    }
  });

  it('preserves all 9 documented source anomalies without silent manipulation', () => {
    const anomalyIds = ['EW114', 'EW249', 'EW262', 'EW265', 'EW574', 'EW576', 'EW894', 'EW913', 'EW943'];
    for (const anomId of anomalyIds) {
      const match = allActivities.find(a => a.source.ewId === anomId && a.role === 'new');
      expect(match).toBeDefined();
      expect(match!.source.hasSourceAnomaly).toBe(true);
      expect(match!.source.anomalyNote).toBeDefined();
      expect(typeof match!.source.anomalyNote).toBe('string');
      expect(match!.source.anomalyNote!.length).toBeGreaterThan(10);
    }
  });

  it('preserves full source traceability on every record', () => {
    for (const act of allActivities) {
      expect(act.source).toBeDefined();
      expect(act.source.workbook).toBeDefined();
      expect(act.source.ewId).toMatch(/^EW\d{3}$/);
      expect(act.source.activityCode).toMatch(/^E\d{2}$/);
      expect(act.source.originalActivity).toBeDefined();
      expect(act.subject).toBe('English');
      expect(act.classLevel).toBe(3);
      expect(act.language).toBe('en-IN');
      expect(act.prompt.length).toBeGreaterThan(0);
      expect(act.correctAnswer.length).toBeGreaterThan(0);
      expect(act.targetWord!.length).toBeGreaterThan(0);
    }
  });

  it('verifies normalized difficulty mapping and preservation of sourceDifficulty', () => {
    const allowedSourceDiffs = ['Easy', 'Medium', 'Hard', 'Mixed', 'Unclassified'];
    for (const act of allActivities) {
      expect(allowedSourceDiffs).toContain(act.sourceDifficulty);
      expect([1, 2, 3]).toContain(act.level);

      if (act.sourceDifficulty === 'Easy') expect(act.level).toBe(1);
      if (act.sourceDifficulty === 'Medium') expect(act.level).toBe(2);
      if (act.sourceDifficulty === 'Hard') expect(act.level).toBe(3);
      if (act.sourceDifficulty === 'Mixed') expect(act.level).toBe(2);
      if (act.sourceDifficulty === 'Unclassified') expect(act.level).toBe(2);
    }
  });

  it('verifies daily allocations for all modules', () => {
    for (let m = 1; m <= 8; m++) {
      const acts = moduleActivities[m];
      const byDay: Record<number, { newCount: number; revCount: number }> = {
        1: { newCount: 0, revCount: 0 },
        2: { newCount: 0, revCount: 0 },
        3: { newCount: 0, revCount: 0 },
        4: { newCount: 0, revCount: 0 },
        5: { newCount: 0, revCount: 0 }
      };

      for (const act of acts) {
        expect(act.day).toBeDefined();
        const dayNum = act.day!;
        expect(dayNum).toBeGreaterThanOrEqual(1);
        expect(dayNum).toBeLessThanOrEqual(5);
        if (act.role === 'new') byDay[dayNum].newCount++;
        else byDay[dayNum].revCount++;
      }

      if (m <= 7) {
        for (let d = 1; d <= 5; d++) {
          expect(byDay[d].newCount).toBe(24);
          if (m >= 2) {
            expect(byDay[d].revCount).toBe(8);
          }
        }
      } else {
        // Module 8: 24, 24, 24, 23, 23 new; 8 review each day
        expect(byDay[1].newCount).toBe(24);
        expect(byDay[2].newCount).toBe(24);
        expect(byDay[3].newCount).toBe(24);
        expect(byDay[4].newCount).toBe(23);
        expect(byDay[5].newCount).toBe(23);
        for (let d = 1; d <= 5; d++) {
          expect(byDay[d].revCount).toBe(8);
        }
      }
    }
  });

  it('verifies semantic asset requirements manifest structure', () => {
    const assetPath = path.join(ENG_DIR, 'assets.json');
    expect(fs.existsSync(assetPath)).toBe(true);

    const assetRequirements = JSON.parse(fs.readFileSync(assetPath, 'utf-8'));
    expect(Array.isArray(assetRequirements)).toBe(true);
    expect(assetRequirements.length).toBe(343);

    let mappedCount = 0;
    let missingCount = 0;
    let textOnlyCount = 0;

    for (const req of assetRequirements) {
      expect(req.activityId).toBeDefined();
      expect(req.ewId).toBeDefined();
      expect(req.targetWord).toBeDefined();
      expect(req.assetId).toMatch(/^eng-[a-z0-9-]+$/);
      expect(['missing', 'mapped', 'text_only']).toContain(req.status);

      if (req.status === 'mapped') {
        mappedCount++;
        expect(req.required).toBe(true);
        if (req.reusedFromTamilAssetId) {
          expect(req.proposedPath).toMatch(/^\/assets\/class-3\/tamil\/term-1\/images\//);
        } else {
          expect(req.resolvedPath).toMatch(/^\/assets\/class-3\/english\/images\//);
        }
      } else if (req.status === 'missing') {
        missingCount++;
        expect(req.required).toBe(true);
        expect(req.proposedPath).toMatch(/^\/assets\/class-3\/english\/images\//);
      } else if (req.status === 'text_only') {
        textOnlyCount++;
        expect(req.required).toBe(false);
      }
    }

    expect(mappedCount).toBe(335);
    expect(missingCount).toBe(0);
    expect(textOnlyCount).toBe(8);

    // Also verify asset-manifest.json exists and has valid local entries
    const manifestPath = path.join(ENG_DIR, 'asset-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(Object.keys(manifest).length).toBe(255);
    for (const [key, entry] of Object.entries(manifest)) {
      expect(key).toMatch(/^eng-/);
      expect((entry as { type: string }).type).toBe('image');
      expect((entry as { source: string }).source).toBe('local');
      const localFilePath = path.resolve('public', (entry as { path: string }).path.replace(/^\//, ''));
      expect(fs.existsSync(localFilePath)).toBe(true);
    }
  });
});
