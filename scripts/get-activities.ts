import * as fs from 'fs';
import * as path from 'path';
// @ts-expect-error - no types for xlsx using require/import like this
import * as xlsx from 'xlsx';

const bankFile = path.resolve('Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144.xlsx');

const buf = fs.readFileSync(bankFile);
const wb = xlsx.read(buf, { type: 'buffer' });
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const activities = new Set<string>();
data.forEach((row: Record<string, unknown>) => {
  if (row['Activity']) {
    activities.add(row['Activity']);
  }
});

console.log('Unique Activities:', Array.from(activities));
