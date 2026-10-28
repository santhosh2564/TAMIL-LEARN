import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const targetIds = ['FTS0497', 'FTS0524', 'FTS0545', 'FTS0324', 'FTS0557', 'FTS0290'];

console.log('=== 1. ROWS FROM docs/workbook-reconciliation.csv VERBATIM ===');
const csvContent = fs.readFileSync('docs/workbook-reconciliation.csv', 'utf8');
const csvLines = csvContent.split(/\r?\n/);
console.log(csvLines[0]);
let matchCount = 0;
for (const line of csvLines) {
  for (const id of targetIds) {
    if (line.startsWith(id + ',')) {
      console.log(line);
      matchCount++;
    }
  }
}
console.log(`(Total matched rows in CSV: ${matchCount}. IDs with 0 rows had zero differences against the workbook)`);

console.log('\n=== 2. WORKBOOK MASTER ALLOCATION VALUES FOR THESE 6 IDS ===');
const wb = xlsx.readFile('Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx');
const master: any[] = xlsx.utils.sheet_to_json(wb.Sheets['Master Allocation']);
for (const id of targetIds) {
  const r = master.find(x => String(x['Source ID'] || '').trim() === id || String(x['FTS ID'] || '').trim() === id);
  if (r) {
    console.log(`ID: ${id} | Module: ${r['Module']} | Target Word: ${r['Target Word']} | Activity: ${r['Activity']} | Options/Units: ${r['Options / Units']}`);
  }
}

console.log('\n=== 3. targetWord AND options FROM src/content/class-3/tamil/activities.json ===');
const activities: any[] = JSON.parse(fs.readFileSync('src/content/class-3/tamil/activities.json', 'utf8'));
for (const id of targetIds) {
  const act = activities.find(a => a.id === id);
  if (act) {
    const opts = act.units || act.options?.map((o: any) => o.label || o.text || o);
    console.log(`ID: ${id} | module: ${act.module} | targetWord: ${act.targetWord} | options: ${JSON.stringify(opts)}`);
  }
}

console.log('\n=== 4. targetWord AND options FROM module-N/activities.json ===');
for (let m = 1; m <= 8; m++) {
  const modPath = `src/content/class-3/tamil/module-${m}/activities.json`;
  if (fs.existsSync(modPath)) {
    const modActs: any[] = JSON.parse(fs.readFileSync(modPath, 'utf8'));
    for (const id of targetIds) {
      const act = modActs.find(a => a.id === id);
      if (act) {
        const opts = act.units || act.options?.map((o: any) => o.label || o.text || o);
        console.log(`Module ${m} -> ID: ${id} | targetWord: ${act.targetWord} | options: ${JSON.stringify(opts)}`);
      }
    }
  }
}
