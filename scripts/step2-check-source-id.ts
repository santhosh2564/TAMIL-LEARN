import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const wb = xlsx.readFile('Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx');
const master: any[] = xlsx.utils.sheet_to_json(wb.Sheets['Master Allocation']);
const activities: any[] = JSON.parse(fs.readFileSync('src/content/class-3/tamil/activities.json', 'utf8'));

const actMap = new Map<string, any>();
for (const a of activities) {
  actMap.set(a.id, a);
}

console.log(`Workbook rows: ${master.length}, Activities: ${activities.length}`);

// Check Source ID vs FTS ID
let diffCount = 0;
const diffSamples: any[] = [];
for (const r of master) {
  const sid = String(r['Source ID'] || '').trim();
  const fid = String(r['FTS ID'] || '').trim();
  if (sid !== fid) {
    diffCount++;
    if (diffSamples.length < 5) diffSamples.push({ sid, fid, word: r['Target Word'] });
  }
}
console.log(`Rows where Source ID !== FTS ID: ${diffCount}`);
if (diffSamples.length > 0) {
  console.log('Sample differences between Source ID and FTS ID:', diffSamples);
}

// Print 10 sample rows showing Source ID, FTS ID and our id side by side
console.log('\n=== 10 SAMPLE ROWS: Source ID | FTS ID | Our id | Target Word ===');
for (let i = 0; i < 10; i++) {
  const r = master[i * 100]; // sample across the sheet
  const sid = String(r['Source ID'] || '').trim();
  const fid = String(r['FTS ID'] || '').trim();
  const act = actMap.get(sid) || actMap.get(fid);
  console.log(`Sample ${i + 1}: Source ID: ${sid.padEnd(8)} | FTS ID: ${fid.padEnd(8)} | Our id: ${(act ? act.id : 'NOT FOUND').padEnd(8)} | Target: ${r['Target Word']}`);
}
