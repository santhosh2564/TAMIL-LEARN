import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
import { LocalContentRepository } from '../../../../repositories/implementations/LocalContentRepository';
import { TamilProgressService } from '../../../../progress/TamilProgressService';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const ORIGINAL_WORKBOOK = path.resolve('Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx');
const ALLOCATED_WORKBOOK = path.resolve('Tamil_Fresh_Source_Word_List_FINAL_1059_Allocated_40Days.xlsx');

describe('Tamil 8 Modules × 5 Days (40 Days) Master Allocation Validation', () => {
  const origWb = xlsx.readFile(ORIGINAL_WORKBOOK);
  const allocWb = xlsx.readFile(ALLOCATED_WORKBOOK);

  const origMasterRows: any[] = xlsx.utils.sheet_to_json(origWb.Sheets['Master Allocation']);
  const allocMasterRows: any[] = xlsx.utils.sheet_to_json(allocWb.Sheets['Master Allocation']);

  it('Requirement 1 & 12: All 1,178 source records are accounted for and total equals 1,178', () => {
    expect(origMasterRows.length).toBe(1178);
    expect(allocMasterRows.length).toBe(1178);

    let total40DaysRows = 0;
    for (let m = 1; m <= 8; m++) {
      for (let d = 1; d <= 5; d++) {
        const sheetName = `M${m}_D${d}`;
        const dayWs = allocWb.Sheets[sheetName];
        expect(dayWs).toBeDefined();
        const rows: any[] = xlsx.utils.sheet_to_json(dayWs);
        total40DaysRows += rows.length;
      }
    }
    expect(total40DaysRows).toBe(1178);
  });

  it('Requirement 2: Every source record belongs to exactly one module (Modules 1–8 preserved)', () => {
    const origModuleCounts: Record<string, number> = {};
    const allocModuleCounts: Record<string, number> = {};

    for (const r of origMasterRows) {
      const m = String(r['Module']).trim();
      origModuleCounts[m] = (origModuleCounts[m] || 0) + 1;
    }

    for (const r of allocMasterRows) {
      const m = String(r['Module']).trim();
      allocModuleCounts[m] = (allocModuleCounts[m] || 0) + 1;
    }

    expect(allocModuleCounts).toEqual(origModuleCounts);

    // Verify row-by-row module assignment matches original exactly
    const origMap = new Map<string, any>(origMasterRows.map(r => [r['Source ID'], r]));
    for (const r of allocMasterRows) {
      const orig = origMap.get(r['Source ID']);
      expect(orig).toBeDefined();
      expect(r['Module']).toBe(orig['Module']);
    }
  });

  it('Requirement 3 & 4: Every source record belongs to exactly one day (Days 1–5), each module has 5 days', () => {
    const validDays = new Set(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']);
    const validDayNumbers = new Set([1, 2, 3, 4, 5]);

    for (const r of allocMasterRows) {
      expect(validDays.has(r['Day'])).toBe(true);
      expect(validDayNumbers.has(Number(r['Day Number']))).toBe(true);
      expect(Number(r['Position in Day'])).toBeGreaterThanOrEqual(1);
      expect(Number(r['Position in Day'])).toBeLessThanOrEqual(30);
      expect(typeof r['Activity Group']).toBe('string');
      expect(r['Activity Group'].length).toBeGreaterThan(0);
    }
  });

  it('Requirement 5: Each day has 29–30 questions', () => {
    for (let m = 1; m <= 8; m++) {
      let moduleTotal = 0;
      for (let d = 1; d <= 5; d++) {
        const sheetName = `M${m}_D${d}`;
        const dayRows: any[] = xlsx.utils.sheet_to_json(allocWb.Sheets[sheetName]);
        expect(dayRows.length).toBeGreaterThanOrEqual(29);
        expect(dayRows.length).toBeLessThanOrEqual(30);
        moduleTotal += dayRows.length;
      }
      if (m === 1 || m === 2) {
        expect(moduleTotal).toBe(148);
      } else {
        expect(moduleTotal).toBe(147);
      }
    }
  });

  it('Requirement 6: Activity diversity is balanced across all 40 days', () => {
    for (let m = 1; m <= 8; m++) {
      for (let d = 1; d <= 5; d++) {
        const sheetName = `M${m}_D${d}`;
        const dayRows: any[] = xlsx.utils.sheet_to_json(allocWb.Sheets[sheetName]);
        const activities = new Set(dayRows.map(r => String(r['Activity'] || '').trim()));
        // Each day must contain a varied combination of activity types (at least 7 distinct activities)
        expect(activities.size).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('Requirement 7 & 8: No duplicate source IDs introduced and no original source IDs missing', () => {
    const origSourceIds = new Set(origMasterRows.map(r => r['Source ID']));
    const allocSourceIds = new Set(allocMasterRows.map(r => r['Source ID']));

    expect(allocSourceIds.size).toBe(1178);
    expect(origSourceIds.size).toBe(1178);

    for (const sid of origSourceIds) {
      expect(allocSourceIds.has(sid)).toBe(true);
    }
  });

  it('Requirement 9: All original question instructions, options, and answers remain unchanged', () => {
    const origMap = new Map<string, any>(origMasterRows.map(r => [r['Source ID'], r]));

    for (const r of allocMasterRows) {
      const orig = origMap.get(r['Source ID']);
      expect(orig).toBeDefined();
      expect(r['Target Word']).toBe(orig['Target Word']);
      expect(r['Question / Instruction']).toBe(orig['Question / Instruction']);
      expect(r['Options / Units']).toBe(orig['Options / Units']);
      expect(r['Correct Answer']).toBe(orig['Correct Answer']);
      expect(r['Activity']).toBe(orig['Activity']);
    }
  });

  it('Requirement 10: All picture-required questions retain picture requirements', () => {
    const origMap = new Map<string, any>(origMasterRows.map(r => [r['Source ID'], r]));

    for (const r of allocMasterRows) {
      const orig = origMap.get(r['Source ID']);
      expect(orig).toBeDefined();
      expect(r['Picture Required']).toBe(orig['Picture Required']);
      expect(r['Picture Specification']).toBe(orig['Picture Specification']);
    }
  });

  it('Requirement 11: English curriculum data has not been modified', () => {
    const engManifestPath = path.resolve('src/content/class-3/english/manifest.json');
    const engManifest = JSON.parse(fs.readFileSync(engManifestPath, 'utf8'));

    expect(engManifest.classLevel).toBe(3);
    expect(engManifest.subject).toBe('English');
    expect(engManifest.moduleCount).toBe(8);
    expect(engManifest.totalActivities).toBe(1236);
    expect(engManifest.totalUniqueWords).toBe(957);
  });

  it('Summary Sheet: Day Allocation Summary exists and contains all required tables', () => {
    const summarySheet = allocWb.Sheets['Day Allocation Summary'];
    expect(summarySheet).toBeDefined();
    const rows: any[][] = xlsx.utils.sheet_to_json(summarySheet, { header: 1 });
    expect(rows.length).toBeGreaterThan(45);
  });
});

describe('Tamil React Content Repository & Day Querying', () => {
  const repo = new LocalContentRepository();

  it('retrieves Tamil curriculum manifest with 8 modules and 5 days each', async () => {
    const manifest = await repo.getTamilCurriculumManifest();
    expect(manifest).toBeDefined();
    expect(manifest.moduleCount).toBe(8);
    expect(manifest.activityCount).toBe(1178);
    expect(manifest.modules.length).toBe(8);

    for (const mod of manifest.modules) {
      expect(mod.days.length).toBe(5);
      const totalInDays = mod.days.reduce((acc, d) => acc + d.totalCount, 0);
      expect(totalInDays).toBe(mod.totalActivities);
      for (const d of mod.days) {
        expect(d.totalCount).toBeGreaterThanOrEqual(29);
        expect(d.totalCount).toBeLessThanOrEqual(30);
      }
    }
  });

  it('retrieves individual Tamil module manifests (1 to 8)', async () => {
    for (let m = 1; m <= 8; m++) {
      const mod = await repo.getTamilModuleManifest(m);
      expect(mod).toBeDefined();
      expect(mod?.module).toBe(m);
      expect(mod?.days.length).toBe(5);
      const sumDays = mod?.days.reduce((acc, d) => acc + d.totalCount, 0);
      expect(sumDays).toBe(mod?.totalActivities);
    }

    const invalidMod = await repo.getTamilModuleManifest(9);
    expect(invalidMod).toBeNull();
  });

  it('queries Tamil activities deterministically by module and day', async () => {
    // Module 1 Day 1: 30 activities
    const m1d1 = await repo.getActivities({ subject: 'Tamil', module: 1, day: 1 });
    expect(m1d1.length).toBe(30);
    m1d1.forEach(a => {
      expect(a.module).toBe(1);
      expect(a.day).toBe(1);
      expect(a.subject).toBe('Tamil');
    });

    // Module 1 Day 5: 29 activities
    const m1d5 = await repo.getActivities({ subject: 'Tamil', module: 1, day: 5 });
    expect(m1d5.length).toBe(29);
    m1d5.forEach(a => {
      expect(a.module).toBe(1);
      expect(a.day).toBe(5);
      expect(a.subject).toBe('Tamil');
    });

    // Module 8 Day 5: 29 activities
    const m8d5 = await repo.getActivities({ subject: 'Tamil', module: 8, day: 5 });
    expect(m8d5.length).toBe(29);
    m8d5.forEach(a => {
      expect(a.module).toBe(8);
      expect(a.day).toBe(5);
      expect(a.subject).toBe('Tamil');
    });
  });

  it('TamilProgressService tracks day and module progress independently', async () => {
    const progressService = new TamilProgressService(undefined, repo);
    const dayProg = await progressService.getDayProgress(1, 1);
    expect(dayProg.module).toBe(1);
    expect(dayProg.day).toBe(1);
    expect(dayProg.totalActivities).toBe(30);
    expect(dayProg.completedActivities).toBe(0);
    expect(dayProg.isCompleted).toBe(false);

    const modProg = await progressService.getModuleProgress(1);
    expect(modProg.module).toBe(1);
    expect(modProg.totalActivities).toBe(148);
    expect(modProg.completedDays).toBe(0);

    const currProg = await progressService.getCurriculumProgress();
    expect(currProg.totalActivities).toBe(1178);
    expect(currProg.recommendedSession.module).toBe(1);
    expect(currProg.recommendedSession.day).toBe(1);
  });
});
