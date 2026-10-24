import ExcelJS from 'exceljs';
import path from 'node:path';

interface SheetStats {
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
}

async function getStats(filePath: string): Promise<SheetStats[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const stats: SheetStats[] = [];

  for (const sheet of wb.worksheets) {
    const headers: string[] = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      headers.push(String(cell.value ?? ''));
    });

    stats.push({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      headers
    });
  }

  return stats;
}

async function processWorkbook(filePath: string) {
  console.log(`\n========================================`);
  console.log(`Processing: ${path.basename(filePath)}`);
  console.log(`========================================`);

  const statsBefore = await getStats(filePath);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  let totalDeleted = 0;

  for (const sheet of wb.worksheets) {
    const rowsToDelete: number[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      row.eachCell((cell) => {
        const val = String(cell.value ?? '');
        if (val.includes('EW213') || val.toLowerCase().includes('derry')) {
          if (!rowsToDelete.includes(rowNumber)) {
            rowsToDelete.push(rowNumber);
          }
        }
      });
    });

    // Delete in reverse order if multiple, so row indices do not shift for subsequent deletions
    rowsToDelete.sort((a, b) => b - a);

    for (const rNum of rowsToDelete) {
      console.log(`In sheet "${sheet.name}": deleting Row ${rNum}`);
      const row = sheet.getRow(rNum);
      const vals: string[] = [];
      row.eachCell((c) => vals.push(String(c.value)));
      console.log(`  Deleting content: ${vals.slice(0, 5).join(' | ')}`);
      sheet.spliceRows(rNum, 1);
      totalDeleted++;
    }
  }

  if (totalDeleted > 0) {
    await wb.xlsx.writeFile(filePath);
    console.log(`Successfully saved updated workbook.`);
  } else {
    console.log(`No EW213/derry rows found.`);
  }

  // Verification after write
  const statsAfter = await getStats(filePath);

  console.log(`\n--- Verification Report for ${path.basename(filePath)} ---`);
  for (let i = 0; i < statsBefore.length; i++) {
    const before = statsBefore[i];
    const after = statsAfter[i];
    console.log(`Sheet "${before.name}":`);
    console.log(`  Row count before: ${before.rowCount}, after: ${after.rowCount}`);
    console.log(`  Column count before: ${before.columnCount}, after: ${after.columnCount}`);

    // Check header match
    const headersMatch = before.headers.length === after.headers.length &&
      before.headers.every((h, idx) => h === after.headers[idx]);
    console.log(`  Headers match exactly: ${headersMatch}`);
    if (!headersMatch) {
      console.error(`  Header mismatch!`);
      console.error(`  Before:`, before.headers);
      console.error(`  After:`, after.headers);
    }
  }

  // Double check that EW213 is absent
  const verifyWb = new ExcelJS.Workbook();
  await verifyWb.xlsx.readFile(filePath);
  let remainingEw213 = 0;
  for (const sheet of verifyWb.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const val = String(cell.value ?? '');
        if (val.includes('EW213') || val.toLowerCase().includes('derry')) {
          remainingEw213++;
        }
      });
    });
  }
  console.log(`  Remaining EW213/derry occurrences: ${remainingEw213}`);
}

async function run() {
  await processWorkbook(path.resolve('docs/eng/English_Module_4_120_NEW_40_REVIEW_PROCESSED.xlsx'));
  await processWorkbook(path.resolve('docs/eng/English_Module_5_120_NEW_40_REVIEW_PROCESSED.xlsx'));
}

run();
