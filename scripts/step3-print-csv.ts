import * as fs from 'fs';

const csvContent = fs.readFileSync('docs/workbook-reconciliation.csv', 'utf8');
const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);

const header = lines[0];
const dataLines = lines.slice(1);

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const rows = dataLines.map(l => parseCsvLine(l));

const fieldCounts: Record<string, number> = {};
const reasonCounts: Record<string, number> = {};
const fieldReasonCounts: Record<string, number> = {};

for (const r of rows) {
  const [id, field, wbVal, curVal, reason] = r;
  fieldCounts[field] = (fieldCounts[field] || 0) + 1;
  reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  const fr = `${field} | ${reason}`;
  fieldReasonCounts[fr] = (fieldReasonCounts[fr] || 0) + 1;
}

console.log('=== COUNTS BY FIELD ===');
console.table(fieldCounts);

console.log('=== COUNTS BY REASON ===');
console.table(reasonCounts);

console.log('=== COUNTS BY FIELD AND REASON ===');
console.table(fieldReasonCounts);

const unexplainedOptionsLines: string[] = [header];
for (let i = 0; i < rows.length; i++) {
  const [id, field, wbVal, curVal, reason] = rows[i];
  if (field === 'options' && reason === 'unexplained') {
    unexplainedOptionsLines.push(dataLines[i]);
  }
}

fs.writeFileSync('docs/unexplained-options.txt', unexplainedOptionsLines.join('\n'), 'utf8');
console.log(`\nWrote ${unexplainedOptionsLines.length - 1} unexplained options rows to docs/unexplained-options.txt`);
