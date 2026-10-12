import * as fs from 'fs';
import * as xlsx from 'xlsx';
import * as path from 'path';

const files = [
  'Class_3_Tamil_Stage_2_Revised_Interaction_Mapping_U001_U144.xlsx',
  'Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144.xlsx',
  'Tamil_Revised_Questions_Q010_Q012_Q013_Q029_Q032_Q045_Q079_Q085.xlsx'
];

for (const file of files) {
  const p = path.resolve(file);
  console.log(`=== FILE: ${file} ===`);
  const buf = fs.readFileSync(p);
  const wb = xlsx.read(buf, { type: 'buffer' });
  console.log(`Sheet names:`, wb.SheetNames);
  for (const sheetName of wb.SheetNames) {
    console.log(`--- Sheet: ${sheetName} ---`);
    const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
    console.log(`Row count: ${data.length}`);
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample row 0:', JSON.stringify(data[0], null, 2));
      const keys = Object.keys(data[0]);
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        for (const k of keys) {
          const val = String(row[k] || '');
          if (/fts/i.test(val) || /fts/i.test(k)) {
            console.log(`Match FTS in row ${i}, col "${k}": ${val}`);
          }
        }
      }
    }
  }
}
