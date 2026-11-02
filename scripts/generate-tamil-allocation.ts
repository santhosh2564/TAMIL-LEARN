import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
import { normalizeTamilCategory } from './import-tamil';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');

const SOURCE_WORKBOOK = path.resolve('Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx');
const TARGET_WORKBOOK = path.resolve('Tamil_Fresh_Source_Word_List_FINAL_1059_Allocated_40Days.xlsx');

interface AllocatedRecord {
  rowValues: Record<string, any>;
  targetWord: string;
  sourceId: string;
  module: number;
  activity: string;
  day: string;
  dayNumber: number;
  positionInDay: number;
  activityGroup: string;
  masterSequence: number;
}

interface DayBucket {
  day: number;
  capacity: number;
  records: any[];
}

export async function generateAllocatedWorkbook() {
  console.log('Loading workbook from:', SOURCE_WORKBOOK);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_WORKBOOK);

  const masterSheet = workbook.getWorksheet('Master Allocation');
  if (!masterSheet) {
    throw new Error('Master Allocation sheet not found in source workbook');
  }

  // Read header columns from row 1
  const headerRow = masterSheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell: any, colNumber: number) => {
    headers[colNumber - 1] = String(cell.value).trim();
  });

  console.log(`Original Master Allocation headers (${headers.length}):`, headers);

  // Read all records
  const originalRecords: { rowNumber: number; data: Record<string, any> }[] = [];
  masterSheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return; // Skip header
    const data: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      const cell = row.getCell(c + 1);
      data[headers[c]] = cell.value;
    }
    originalRecords.push({ rowNumber, data });
  });

  console.log(`Read ${originalRecords.length} records from Master Allocation.`);
  if (originalRecords.length !== 1178) {
    throw new Error(`Expected 1178 records, found ${originalRecords.length}`);
  }

  // Allocation mapping: masterSequence -> { day, dayNumber, positionInDay, activityGroup }
  const allocationMap = new Map<number, { day: string; dayNumber: number; positionInDay: number; activityGroup: string }>();
  const moduleDaysMap = new Map<string, AllocatedRecord[]>(); // "M1_D1" -> records

  for (let modNum = 1; modNum <= 8; modNum++) {
    const modRows = originalRecords.filter(r => {
      const mStr = String(r.data['Module'] || '');
      const match = mStr.match(/\d+/);
      return match ? parseInt(match[0], 10) === modNum : false;
    });

    const modTotal = modRows.length;
    const baseCap = Math.floor(modTotal / 5);
    const rem = modTotal % 5;
    const dayCapacities = Array.from({ length: 5 }, (_, i) => baseCap + (i < rem ? 1 : 0));

    // Group by trimmed Activity
    const activityGroups = new Map<string, typeof modRows>();
    for (const r of modRows) {
      const act = String(r.data['Activity'] || '').trim();
      if (!activityGroups.has(act)) {
        activityGroups.set(act, []);
      }
      activityGroups.get(act)!.push(r);
    }

    // Sort activities by size descending
    const sortedActivities = Array.from(activityGroups.entries()).sort((a, b) => b[1].length - a[1].length);

    const days: DayBucket[] = dayCapacities.map((cap, i) => ({
      day: i + 1,
      capacity: cap,
      records: []
    }));

    let dayOffset = 0;
    for (const [actName, items] of sortedActivities) {
      const count = items.length;
      const perDay = Math.floor(count / 5);
      const remItems = count % 5;

      let itemIdx = 0;
      if (perDay > 0) {
        for (let p = 0; p < perDay; p++) {
          for (let d = 0; d < 5; d++) {
            const targetDay = (d + dayOffset) % 5;
            days[targetDay].records.push(items[itemIdx++]);
          }
        }
      }

      for (let r = 0; r < remItems; r++) {
        const eligible = days
          .map((d, idx) => ({
            d,
            idx,
            remainingCap: d.capacity - d.records.length,
            actCount: d.records.filter(it => String(it.data['Activity'] || '').trim() === actName).length
          }))
          .filter(x => x.remainingCap > 0)
          .sort((a, b) => {
            if (b.remainingCap !== a.remainingCap) return b.remainingCap - a.remainingCap;
            if (a.actCount !== b.actCount) return a.actCount - b.actCount;
            return ((a.idx - dayOffset + 5) % 5) - ((b.idx - dayOffset + 5) % 5);
          });

        if (eligible.length > 0) {
          eligible[0].d.records.push(items[itemIdx++]);
        } else {
          const leastFilled = days.slice().sort((a, b) => a.records.length - b.records.length)[0];
          leastFilled.records.push(items[itemIdx++]);
        }
      }

      dayOffset = (dayOffset + 1) % 5;
    }

    // Interleave activities within each day
    for (const day of days) {
      const byAct = new Map<string, any[]>();
      for (const it of day.records) {
        const a = String(it.data['Activity'] || '').trim();
        if (!byAct.has(a)) byAct.set(a, []);
        byAct.get(a)!.push(it);
      }
      const actBuckets = Array.from(byAct.values()).sort((a, b) => b.length - a.length);
      const interleaved: any[] = [];
      while (actBuckets.some(b => b.length > 0)) {
        for (const bucket of actBuckets) {
          if (bucket.length > 0) {
            interleaved.push(bucket.shift());
          }
        }
      }
      day.records = interleaved;

      // Assign positionInDay and metadata
      const key = `M${modNum}_D${day.day}`;
      const allocatedDayRecords: AllocatedRecord[] = [];

      day.records.forEach((rec, idx) => {
        const seq = Number(rec.data['Master Sequence']);
        const rawAct = String(rec.data['Activity'] || '').trim();
        const normGroup = normalizeTamilCategory(rawAct).category;

        const allocInfo = {
          day: `Day ${day.day}`,
          dayNumber: day.day,
          positionInDay: idx + 1,
          activityGroup: normGroup
        };

        allocationMap.set(seq, allocInfo);

        allocatedDayRecords.push({
          rowValues: rec.data,
          targetWord: String(rec.data['Target Word'] || ''),
          sourceId: String(rec.data['Source ID'] || ''),
          module: modNum,
          activity: rawAct,
          day: allocInfo.day,
          dayNumber: allocInfo.dayNumber,
          positionInDay: allocInfo.positionInDay,
          activityGroup: normGroup,
          masterSequence: seq
        });
      });

      moduleDaysMap.set(key, allocatedDayRecords);
    }
  }

  // Update Master Allocation sheet with new columns
  const newCols = ['Day', 'Day Number', 'Position in Day', 'Activity Group'];
  const startCol = headers.length + 1; // 22

  newCols.forEach((colName, i) => {
    const cell = headerRow.getCell(startCol + i);
    cell.value = colName;
    cell.font = { bold: true };
  });

  originalRecords.forEach(rec => {
    const seq = Number(rec.data['Master Sequence']);
    const alloc = allocationMap.get(seq);
    if (!alloc) {
      throw new Error(`Missing allocation for sequence ${seq}`);
    }
    const row = masterSheet.getRow(rec.rowNumber);
    row.getCell(startCol).value = alloc.day;
    row.getCell(startCol + 1).value = alloc.dayNumber;
    row.getCell(startCol + 2).value = alloc.positionInDay;
    row.getCell(startCol + 3).value = alloc.activityGroup;
  });

  console.log('Master Allocation sheet updated with 4 new columns.');

  // Create 40 day-wise sheets: M1_D1 through M8_D5
  const allHeaders = [...headers, ...newCols];

  for (let m = 1; m <= 8; m++) {
    for (let d = 1; d <= 5; d++) {
      const sheetKey = `M${m}_D${d}`;
      const dayRecords = moduleDaysMap.get(sheetKey) || [];

      // Remove existing worksheet if it exists (for idempotency)
      const existingSheet = workbook.getWorksheet(sheetKey);
      if (existingSheet) {
        workbook.removeWorksheet(existingSheet.id);
      }

      const daySheet = workbook.addWorksheet(sheetKey);

      // Header row
      const dHeaderRow = daySheet.getRow(1);
      allHeaders.forEach((h, colIdx) => {
        const cell = dHeaderRow.getCell(colIdx + 1);
        cell.value = h;
        cell.font = { bold: true };
      });

      // Data rows
      dayRecords.forEach((rec, rIdx) => {
        const row = daySheet.getRow(rIdx + 2);
        headers.forEach((h, colIdx) => {
          row.getCell(colIdx + 1).value = rec.rowValues[h];
        });
        row.getCell(startCol).value = rec.day;
        row.getCell(startCol + 1).value = rec.dayNumber;
        row.getCell(startCol + 2).value = rec.positionInDay;
        row.getCell(startCol + 3).value = rec.activityGroup;
      });

      daySheet.columns.forEach((col: any) => {
        col.width = 18;
      });
    }
  }
  console.log('Created 40 day-wise sheets: M1_D1 through M8_D5.');

  // Create "Day Allocation Summary" sheet
  const summarySheetName = 'Day Allocation Summary';
  const existingSum = workbook.getWorksheet(summarySheetName);
  if (existingSum) {
    workbook.removeWorksheet(existingSum.id);
  }

  const summarySheet = workbook.addWorksheet(summarySheetName);

  // Title
  summarySheet.mergeCells('A1:G1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'Tamil Curriculum Master Allocation: 8 Modules × 5 Days (40 Days Total)';
  titleCell.font = { size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { horizontal: 'center' };

  // Section 1: Module-level Summary Table
  summarySheet.getCell('A3').value = 'Module-Level 5-Day Distribution Summary';
  summarySheet.getCell('A3').font = { size: 12, bold: true };

  const modSummaryHeaders = ['Module', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Module Total'];
  const modHeaderRow = summarySheet.getRow(4);
  modSummaryHeaders.forEach((h, i) => {
    const c = modHeaderRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
  });

  let totalD1 = 0, totalD2 = 0, totalD3 = 0, totalD4 = 0, totalD5 = 0, grandTotal = 0;

  for (let m = 1; m <= 8; m++) {
    const row = summarySheet.getRow(4 + m);
    const d1Count = (moduleDaysMap.get(`M${m}_D1`) || []).length;
    const d2Count = (moduleDaysMap.get(`M${m}_D2`) || []).length;
    const d3Count = (moduleDaysMap.get(`M${m}_D3`) || []).length;
    const d4Count = (moduleDaysMap.get(`M${m}_D4`) || []).length;
    const d5Count = (moduleDaysMap.get(`M${m}_D5`) || []).length;
    const mTotal = d1Count + d2Count + d3Count + d4Count + d5Count;

    totalD1 += d1Count;
    totalD2 += d2Count;
    totalD3 += d3Count;
    totalD4 += d4Count;
    totalD5 += d5Count;
    grandTotal += mTotal;

    row.getCell(1).value = `Module ${m}`;
    row.getCell(2).value = d1Count;
    row.getCell(3).value = d2Count;
    row.getCell(4).value = d3Count;
    row.getCell(5).value = d4Count;
    row.getCell(6).value = d5Count;
    row.getCell(7).value = mTotal;

    for (let c = 1; c <= 7; c++) {
      row.getCell(c).alignment = { horizontal: c === 1 ? 'left' : 'center' };
    }
  }

  // Grand Total row
  const totRow = summarySheet.getRow(13);
  totRow.getCell(1).value = 'Curriculum Total';
  totRow.getCell(2).value = totalD1;
  totRow.getCell(3).value = totalD2;
  totRow.getCell(4).value = totalD3;
  totRow.getCell(5).value = totalD4;
  totRow.getCell(6).value = totalD5;
  totRow.getCell(7).value = grandTotal;
  for (let c = 1; c <= 7; c++) {
    totRow.getCell(c).font = { bold: true };
    totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    totRow.getCell(c).alignment = { horizontal: c === 1 ? 'left' : 'center' };
  }

  // Section 2: Day-by-Day Allocation & Activity Diversity Summary
  summarySheet.getCell('A16').value = 'Day-by-Day Allocation & Activity Distribution (40 Days)';
  summarySheet.getCell('A16').font = { size: 12, bold: true };

  const dayHeaders = ['Module', 'Day', 'Total Questions', 'Activity Types', 'Activity Distribution'];
  const dayHeaderRow = summarySheet.getRow(17);
  dayHeaders.forEach((h, i) => {
    const c = dayHeaderRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    c.alignment = { horizontal: i < 2 ? 'left' : (i === 2 || i === 3 ? 'center' : 'left') };
  });

  let currentRowIdx = 18;
  for (let m = 1; m <= 8; m++) {
    for (let d = 1; d <= 5; d++) {
      const row = summarySheet.getRow(currentRowIdx++);
      const records = moduleDaysMap.get(`M${m}_D${d}`) || [];
      const actCounts: Record<string, number> = {};
      for (const r of records) {
        actCounts[r.activity] = (actCounts[r.activity] || 0) + 1;
      }
      const actTypesCount = Object.keys(actCounts).length;
      const distStr = Object.entries(actCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');

      row.getCell(1).value = `Module ${m}`;
      row.getCell(2).value = `Day ${d}`;
      row.getCell(3).value = records.length;
      row.getCell(4).value = actTypesCount;
      row.getCell(5).value = distStr;

      row.getCell(1).alignment = { horizontal: 'left' };
      row.getCell(2).alignment = { horizontal: 'left' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'left' };
    }
  }

  summarySheet.getColumn(1).width = 16;
  summarySheet.getColumn(2).width = 12;
  summarySheet.getColumn(3).width = 18;
  summarySheet.getColumn(4).width = 18;
  summarySheet.getColumn(5).width = 85;

  console.log('Writing target allocated workbook to:', TARGET_WORKBOOK);
  await workbook.xlsx.writeFile(TARGET_WORKBOOK);
  console.log('Successfully generated allocated workbook!');

  return {
    targetWorkbook: TARGET_WORKBOOK,
    allocationMap,
    moduleDaysMap,
    totalRecords: originalRecords.length
  };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/generate-tamil-allocation.ts')) {
  generateAllocatedWorkbook()
    .then(res => {
      console.log('Done! Total records processed:', res.totalRecords);
      process.exit(0);
    })
    .catch(err => {
      console.error('Error generating allocated workbook:', err);
      process.exit(1);
    });
}

