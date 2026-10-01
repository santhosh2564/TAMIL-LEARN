import * as fs from 'fs';
import * as path from 'path';
// @ts-expect-error - no types for xlsx using require/import like this
import * as xlsx from 'xlsx';

import { Activity, ActivityCategory, ActivityVariant, ContentManifest, ActivityOption } from '../src/types';

const MAPPING_FILE = path.resolve('Class_3_Tamil_Stage_2_Revised_Interaction_Mapping_U001_U144.xlsx');
const BANK_FILE = path.resolve('Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144.xlsx');
const OUT_DIR = path.resolve('src/content/class-3/tamil/term-1');
const DOCS_DIR = path.resolve('docs');

function readSheet(filePath: string): Record<string, unknown>[] {
  const buf = fs.readFileSync(filePath);
  const wb = xlsx.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  return xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
}

function normalizeCategory(original: string): { category: ActivityCategory; variant: ActivityVariant } {
  const norm = original.trim();
  switch (norm) {
    case 'Picture → Select':
    case 'Picture → Context/Select':
      return { category: 'picture-recognition', variant: 'select' };
    
    case 'Drag & Drop Missing Unit':
    case 'Drag & Drop Missing Ending':
    case 'English Meaning + Missing Unit':
    case 'Picture → Missing Unit':
      return { category: 'word-completion', variant: 'missing-unit' };
    
    case 'Arrange Tamil Units':
    case 'Picture → Arrange':
    case 'English Meaning → Arrange Tamil Word':
    case 'English Meaning → Arrange Tamil Units':
      return { category: 'arrange-word', variant: 'arrange' };
    
    case 'Correct Spelling':
    case 'Picture → Correct Spelling':
    case 'Context → Correct Spelling':
      return { category: 'spelling-choice', variant: 'select' };
    
    case 'Context → Drag Word':
    case 'Context → Select/Drag':
      return { category: 'context-choice', variant: 'fill-blank' };
      
    case 'English Meaning → Tamil Word':
      return { category: 'meaning-match', variant: 'translate-select' };
      
    default:
      console.warn(`Unknown activity mapping: ${original}`);
      // Fallback
      return { category: 'picture-recognition', variant: 'select' };
  }
}

function getLevel(levelStr: string): number {
  if (!levelStr) return 1;
  const l = levelStr.toLowerCase();
  if (l.includes('easy')) return 1;
  if (l.includes('medium')) return 2;
  if (l.includes('hard')) return 3;
  return 1;
}

function run() {
  const mappingData = readSheet(MAPPING_FILE);
  const bankData = readSheet(BANK_FILE);

  const mappingsById = new Map<string, Record<string, unknown>>();
  mappingData.forEach(row => {
    const id = row['Unique ID'];
    if (id) {
      const suffix = id.replace('U-', '');
      mappingsById.set(suffix, row);
    }
  });

  const activities: Activity[] = [];
  const stats = {
    total: 0,
    byLevel: { 1: 0, 2: 0, 3: 0 } as Record<number, number>,
    byCategory: {} as Record<string, number>,
    byVariant: {} as Record<string, number>,
    matched: 0,
    unmatched: 0,
  };

  bankData.forEach(bankRow => {
    const qid = bankRow['Question ID'];
    if (!qid) return;
    const suffix = qid.replace('Q', '');
    const mappingRow = mappingsById.get(suffix);
    
    if (mappingRow) {
      stats.matched++;
    } else {
      stats.unmatched++;
    }

    const originalActivity = bankRow['Activity'] || (mappingRow && mappingRow['Proposed Primary Interaction']) || '';
    const { category, variant } = normalizeCategory(originalActivity);
    
    const level = getLevel(bankRow['Level'] || (mappingRow && mappingRow['Difficulty']));
    
    stats.total++;
    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    stats.byVariant[variant] = (stats.byVariant[variant] || 0) + 1;

    let options: ActivityOption[] | undefined;
    let units: string[] | undefined;

    const rawOptions = bankRow['Options / Units'];
    if (rawOptions && typeof rawOptions === 'string') {
      const parts = rawOptions.split('|').map(p => p.trim());
      if (variant === 'arrange' || variant === 'missing-unit') {
        units = parts;
      }
      options = parts.map((p, i) => ({ id: String.fromCharCode(65 + i), label: p }));
    }

    const activity: Activity = {
      id: qid,
      classLevel: 3,
      subject: 'Tamil',
      language: 'ta-IN',
      term: 'Term I',
      level,
      targetWord: bankRow['Target Word'],
      category,
      variant,
      prompt: bankRow['Question / Instruction'] || '',
      options,
      units,
      correctAnswer: bankRow['Correct Answer'] || '',
      learningObjective: mappingRow ? mappingRow['Learning Objective'] : undefined,
      interactionDetail: mappingRow ? mappingRow['Interaction Detail'] : undefined,
      source: {
        workbook: 'Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144.xlsx',
        questionId: qid,
        originalActivity,
      }
    };

    activities.push(activity);
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'activities.json'), JSON.stringify(activities, null, 2));

  const manifest: ContentManifest = {
    classLevel: 3,
    subject: "Tamil",
    term: "Term I",
    language: "ta-IN",
    activityCount: activities.length,
    version: "1.0.0",
    sourceVersion: "Stage 2 Revised",
    generatedDate: new Date().toISOString(),
    supportedCategories: Object.keys(stats.byCategory) as ActivityCategory[],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Generate Stats Report
  let statsMd = `# Content Statistics\n\n`;
  statsMd += `**Total activities:** ${stats.total}\n\n`;
  statsMd += `### Integrity Check\n`;
  statsMd += `- Question Bank: ${bankData.length}\n`;
  statsMd += `- Mapping: ${mappingData.length}\n`;
  statsMd += `- Normalized: ${stats.total}\n`;
  statsMd += `- Matched: ${stats.matched}\n`;
  statsMd += `- Unmatched: ${stats.unmatched}\n\n`;
  
  statsMd += `### By Level\n`;
  Object.entries(stats.byLevel).forEach(([lvl, count]) => {
    statsMd += `- Level ${lvl}: ${count}\n`;
  });

  statsMd += `\n### By Category\n`;
  Object.entries(stats.byCategory).forEach(([cat, count]) => {
    statsMd += `- ${cat}: ${count}\n`;
  });

  statsMd += `\n### By Variant\n`;
  Object.entries(stats.byVariant).forEach(([varName, count]) => {
    statsMd += `- ${varName}: ${count}\n`;
  });

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOCS_DIR, 'content-statistics.md'), statsMd);
  console.log('Import completed successfully.');
}

run();
