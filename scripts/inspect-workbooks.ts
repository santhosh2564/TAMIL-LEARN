import ExcelJS from 'exceljs';
import path from 'node:path';

async function inspect(filePath: string) {
  console.log(`\n=== Inspecting: ${filePath} ===`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  for (const sheet of workbook.worksheets) {
    console.log(`Sheet name: "${sheet.name}"`);
    console.log(`Total rows: ${sheet.rowCount}, Total columns: ${sheet.columnCount}`);

    // Read header row (Row 1)
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers.push(`[${colNumber}]: ${String(cell.value)}`);
    });
    console.log(`Header count: ${headers.length}`);
    console.log(`Headers: ${headers.slice(0, 10).join(', ')} ...`);

    // Search for EW213 or derry
    const matchingRows: number[] = [];
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        const val = String(cell.value ?? '');
        if (val.includes('EW213') || val.toLowerCase().includes('derry')) {
          if (!matchingRows.includes(rowNumber)) {
            matchingRows.push(rowNumber);
          }
        }
      });
    });

    console.log(`Matching rows for EW213/derry: ${matchingRows.length > 0 ? matchingRows.join(', ') : 'none'}`);
    for (const rNum of matchingRows) {
      const row = sheet.getRow(rNum);
      const rowVals: string[] = [];
      row.eachCell((c) => rowVals.push(String(c.value)));
      console.log(`  Row ${rNum}: ${rowVals.slice(0, 6).join(' | ')}`);
    }
  }
}

async function run() {
  await inspect(path.resolve('docs/eng/English_Module_4_120_NEW_40_REVIEW_PROCESSED.xlsx'));
  await inspect(path.resolve('docs/eng/English_Module_5_120_NEW_40_REVIEW_PROCESSED.xlsx'));
}

run();
