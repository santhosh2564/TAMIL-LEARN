import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { Activity } from '../src/types';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const WORKBOOK_PATH = path.resolve('Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx');
const ACTIVITIES_FILE = path.resolve('src/content/class-3/tamil/activities.json');
const OUT_CSV = path.resolve('docs/workbook-reconciliation.csv');

// 1. Collect intentional-fix IDs
const intentionalSet = new Set<string>();

// From docs/tamil-clues-for-review.csv
const cluesCsv = fs.readFileSync('docs/tamil-clues-for-review.csv', 'utf8');
for (const line of cluesCsv.split(/\r?\n/)) {
  const m = line.match(/^(FTS\d+|Q\d+)/);
  if (m) intentionalSet.add(m[1].trim());
}

// From docs/missing-images.csv
const missingCsv = fs.readFileSync('docs/missing-images.csv', 'utf8');
for (const line of missingCsv.split(/\r?\n/)) {
  const matches = line.match(/(FTS\d+|Q\d+)/g) || [];
  matches.forEach(id => intentionalSet.add(id.trim()));
}

// From git commit messages
const commitLogs = execSync('git log --format=%B', { encoding: 'utf8' });
const commitMatches = commitLogs.match(/(?:FTS\d+|Q\d+)/g) || [];
commitMatches.forEach(id => intentionalSet.add(id.trim()));

console.log(`Loaded ${intentionalSet.size} intentional-fix IDs from review CSVs and commit logs.`);

// 2. Load workbook and activities
const wb = xlsx.readFile(WORKBOOK_PATH);
const master: Record<string, unknown>[] = xlsx.utils.sheet_to_json(wb.Sheets['Master Allocation']);
const activities: Activity[] = JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf8'));

const currentMap = new Map<string, Activity>();
for (const a of activities) {
  currentMap.set(a.id, a);
}

interface DiffRow {
  id: string;
  field: 'prompt' | 'correctAnswer' | 'options' | 'targetWord' | 'module';
  workbook_value: string;
  current_value: string;
  reason: 'intentional-fix' | 'unexplained';
}

const diffRows: DiffRow[] = [];
const unexplainedMap = new Map<string, string[]>(); // id -> array of divergent field names

for (const m of master) {
  const id = ((m['Source ID'] || m['Question ID'] || m['FTS ID'] || `REC_${m['Master Sequence']}`) as string).trim();
  const act = currentMap.get(id);
  if (!act) {
    console.warn(`Activity ${id} not found in current activities.`);
    continue;
  }

  const isIntentional = intentionalSet.has(id);
  const reason: 'intentional-fix' | 'unexplained' = isIntentional ? 'intentional-fix' : 'unexplained';

  // Field 1: module
  const wbMod = parseInt(String(m['Module']).replace(/\D/g, ''), 10);
  const curMod = act.module;
  if (wbMod !== curMod) {
    diffRows.push({
      id,
      field: 'module',
      workbook_value: String(wbMod),
      current_value: String(curMod),
      reason
    });
    if (!isIntentional) {
      const arr = unexplainedMap.get(id) || [];
      arr.push('module');
      unexplainedMap.set(id, arr);
    }
  }

  // Field 2: targetWord
  const wbTarget = String(m['Target Word'] ?? '').trim();
  const curTarget = String(act.targetWord ?? '').trim();
  if (wbTarget !== curTarget) {
    diffRows.push({
      id,
      field: 'targetWord',
      workbook_value: wbTarget,
      current_value: curTarget,
      reason
    });
    if (!isIntentional) {
      const arr = unexplainedMap.get(id) || [];
      arr.push('targetWord');
      unexplainedMap.set(id, arr);
    }
  }

  // Field 3: correctAnswer
  const wbAns = String(m['Correct Answer'] ?? '').trim();
  const curAns = String(Array.isArray(act.correctAnswer) ? act.correctAnswer.join(' | ') : (act.correctAnswer ?? '')).trim();
  if (wbAns !== curAns) {
    diffRows.push({
      id,
      field: 'correctAnswer',
      workbook_value: wbAns,
      current_value: curAns,
      reason
    });
    if (!isIntentional) {
      const arr = unexplainedMap.get(id) || [];
      arr.push('correctAnswer');
      unexplainedMap.set(id, arr);
    }
  }

  // Field 4: options
  const wbOptRaw = String(m['Options / Units'] ?? '').trim();
  const curOptList = act.units || (act.options ? act.options.map(o => o.label) : []);
  const curOptRaw = curOptList.join(' | ');
  const wbTokens = wbOptRaw.split(/[|\/]/).map(s => s.trim()).filter(Boolean);
  const curTokens = curOptList.map(s => s.trim()).filter(Boolean);
  if (wbTokens.join(' | ') !== curTokens.join(' | ')) {
    diffRows.push({
      id,
      field: 'options',
      workbook_value: wbOptRaw,
      current_value: curOptRaw,
      reason
    });
    if (!isIntentional) {
      const arr = unexplainedMap.get(id) || [];
      arr.push('options');
      unexplainedMap.set(id, arr);
    }
  }

  // Field 5: prompt
  const wbPrompt = String(m['Question / Instruction'] ?? '').trim();
  const curPrompt = String(act.prompt ?? '').trim();
  if (wbPrompt !== curPrompt) {
    diffRows.push({
      id,
      field: 'prompt',
      workbook_value: wbPrompt,
      current_value: curPrompt,
      reason
    });
    if (!isIntentional) {
      const arr = unexplainedMap.get(id) || [];
      arr.push('prompt');
      unexplainedMap.set(id, arr);
    }
  }
}

// Write docs/workbook-reconciliation.csv
function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

const csvLines = ['id,field,workbook_value,current_value,reason'];
for (const r of diffRows) {
  csvLines.push(`${escapeCsv(r.id)},${escapeCsv(r.field)},${escapeCsv(r.workbook_value)},${escapeCsv(r.current_value)},${escapeCsv(r.reason)}`);
}

fs.writeFileSync(OUT_CSV, csvLines.join('\n'), 'utf8');
console.log(`Wrote ${diffRows.length} differences to ${OUT_CSV}`);

// Print summary counts per field and per reason
const countByFieldAndReason: Record<string, number> = {};
const countByField: Record<string, number> = {
  prompt: 0,
  correctAnswer: 0,
  options: 0,
  targetWord: 0,
  module: 0
};
const countByReason: Record<string, number> = {
  'intentional-fix': 0,
  'unexplained': 0
};

for (const r of diffRows) {
  const k = `${r.field} | ${r.reason}`;
  countByFieldAndReason[k] = (countByFieldAndReason[k] || 0) + 1;
  countByField[r.field] = (countByField[r.field] || 0) + 1;
  countByReason[r.reason] = (countByReason[r.reason] || 0) + 1;
}

console.log('\n=== COUNTS BY FIELD ===');
console.table(countByField);

console.log('=== COUNTS BY REASON ===');
console.table(countByReason);

console.log('=== COUNTS BY FIELD AND REASON ===');
console.table(countByFieldAndReason);

// 3. Update activities: set source.workbook = new file for all.
// For activities with unexplained differences, set source.divergesFromWorkbook = true and source.divergentFields
const updatedActivities = activities.map(act => {
  const unexplainedFields = unexplainedMap.get(act.id);
  const updatedSource: any = {
    ...act.source,
    workbook: 'Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx'
  };

  if (unexplainedFields && unexplainedFields.length > 0) {
    updatedSource.divergesFromWorkbook = true;
    updatedSource.divergentFields = unexplainedFields;
  } else {
    delete updatedSource.divergesFromWorkbook;
    delete updatedSource.divergentFields;
  }

  return {
    ...act,
    source: updatedSource
  };
});

fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(updatedActivities, null, 2), 'utf8');

// Update per-module files
for (let m = 1; m <= 8; m++) {
  const modActs = updatedActivities.filter(a => a.module === m);
  const modFile = path.resolve(`src/content/class-3/tamil/module-${m}/activities.json`);
  fs.writeFileSync(modFile, JSON.stringify(modActs, null, 2), 'utf8');
}

console.log(`\nUpdated activities with source.workbook and divergence metadata.`);
console.log(`- Questions with zero unexplained differences: ${activities.length - unexplainedMap.size}`);
console.log(`- Questions with unexplained differences (divergesFromWorkbook = true): ${unexplainedMap.size}`);
