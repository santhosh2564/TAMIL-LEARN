import * as fs from 'fs';
import * as path from 'path';
// @ts-expect-error - no types for xlsx using require/import like this
import * as xlsx from 'xlsx';

const mappingFile = path.resolve('Class_3_Tamil_Stage_2_Revised_Interaction_Mapping_U001_U144.xlsx');
const bankFile = path.resolve('Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144.xlsx');

function inspectFile(filePath: string) {
  console.log(`\n\n--- Inspecting: ${path.basename(filePath)} ---`);
  const buf = fs.readFileSync(filePath);
  const wb = xlsx.read(buf, { type: 'buffer' });
  console.log('Sheets:', wb.SheetNames);
  
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`Rows: ${data.length}`);
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0] as object));
    console.log('Sample Row 1:', JSON.stringify(data[0], null, 2));
    console.log('Sample Row 2:', JSON.stringify(data[1], null, 2));
  }
}

inspectFile(mappingFile);
inspectFile(bankFile);
