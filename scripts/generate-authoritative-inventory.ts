import * as fs from 'fs';
import * as path from 'path';

const SOURCE_DIR = path.resolve('tamil_json_by_module_activity');
const INDEX_FILE = path.join(SOURCE_DIR, 'index.json');
const QA_REPORT_DIR = path.resolve('qa-report');

interface RawRecord {
  'Target Word'?: string;
  'Source Type'?: string;
  'Source ID'?: string;
  'FTS ID'?: string;
  'Question ID'?: string | null;
  'Level'?: string | null;
  'Activity'?: string;
  'Question / Instruction'?: string;
  'Options / Units'?: string;
  'Correct Answer'?: string;
  'Source Batch'?: string;
  'Source File'?: string;
  'Picture Required'?: string;
  'Source Meaning / Notes'?: string | number | null;
  'Source Reference / Context'?: string | null;
  'Picture Specification'?: string;
  'Verification Flag'?: string | null;
  'Module'?: string;
  'Position in Module'?: number;
  'Normalized Word'?: string;
  'Master Sequence'?: number;
  image?: {
    path?: string;
    sourcePageUrl?: string;
    license?: string;
    creator?: string;
    attribution?: string;
    imageSource?: string;
    status?: string;
    reviewStatus?: string;
  };
  [key: string]: unknown;
}

export interface InventoryItem {
  module: string;
  activity_file: string;
  activity_id: string;
  question_id: string;
  activity_type: string;
  prompt: string;
  expected_answer: string;
  options: string[];
  units: string[];
  image: string | null;
  target_word: string;
  level: string;
  has_image: boolean;
  has_options: boolean;
  has_units: boolean;
  has_expected_answer: boolean;
}

export interface InventoryReport {
  totalModules: number;
  totalActivityFiles: number;
  totalQuestions: number;
  questionsPerModule: Record<string, number>;
  questionsPerActivityType: Record<string, number>;
  questionsContainingImages: number;
  questionsContainingOptions: number;
  questionsContainingUnits: number;
  questionsContainingExpectedAnswers: number;
  items: InventoryItem[];
}

export function generateInventory(): InventoryReport {
  const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const groups: { module: string; activity: string; record_count: number; file: string }[] = indexData.groups;

  const items: InventoryItem[] = [];
  const moduleCounts: Record<string, number> = {};
  const activityTypeCounts: Record<string, number> = {};
  let questionsWithImages = 0;
  let questionsWithOptions = 0;
  let questionsWithUnits = 0;
  let questionsWithExpectedAnswers = 0;

  const modulesSet = new Set<string>();

  for (const group of groups) {
    modulesSet.add(group.module);
    const filePath = path.join(SOURCE_DIR, group.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File missing: ${filePath}`);
      continue;
    }

    const records: RawRecord[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const rec of records) {
      const actType = (rec['Activity'] || '').trim();
      const mod = rec['Module'] || group.module;
      const activityId = rec['Source ID'] || rec['Question ID'] || rec['FTS ID'] || `REC_${rec['Master Sequence']}`;
      const questionId = rec['Question ID'] || activityId;
      const prompt = (rec['Question / Instruction'] || '').trim();
      const expectedAnswer = (rec['Correct Answer'] || rec['Target Word'] || '').trim();
      const targetWord = (rec['Target Word'] || '').trim();
      const rawOptionsUnits = (rec['Options / Units'] || '').trim();
      const delimiter = rawOptionsUnits.includes('|') ? '|' : (rawOptionsUnits.includes('/') ? '/' : '|');
      const tokens = rawOptionsUnits ? rawOptionsUnits.split(delimiter).map(s => s.trim()).filter(Boolean) : [];

      const isArrange = actType.toLowerCase().includes('arrange');
      const hasImage = Boolean(rec.image?.path) || (rec['Picture Required'] || '').toLowerCase() === 'yes';

      const options = !isArrange ? tokens : [];
      const units = isArrange ? tokens : [];

      if (hasImage) questionsWithImages++;
      if (options.length > 0) questionsWithOptions++;
      if (units.length > 0) questionsWithUnits++;
      if (expectedAnswer.length > 0) questionsWithExpectedAnswers++;

      moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
      activityTypeCounts[actType] = (activityTypeCounts[actType] || 0) + 1;

      items.push({
        module: mod,
        activity_file: group.file,
        activity_id: activityId,
        question_id: questionId,
        activity_type: actType,
        prompt: prompt || targetWord,
        expected_answer: expectedAnswer,
        options,
        units,
        image: rec.image?.path || null,
        target_word: targetWord,
        level: rec['Level'] || 'Level 1',
        has_image: hasImage,
        has_options: options.length > 0,
        has_units: units.length > 0,
        has_expected_answer: expectedAnswer.length > 0
      });
    }
  }

  const report: InventoryReport = {
    totalModules: modulesSet.size,
    totalActivityFiles: groups.length,
    totalQuestions: items.length,
    questionsPerModule: moduleCounts,
    questionsPerActivityType: activityTypeCounts,
    questionsContainingImages: questionsWithImages,
    questionsContainingOptions: questionsWithOptions,
    questionsContainingUnits: questionsWithUnits,
    questionsContainingExpectedAnswers: questionsWithExpectedAnswers,
    items
  };

  if (!fs.existsSync(QA_REPORT_DIR)) {
    fs.mkdirSync(QA_REPORT_DIR, { recursive: true });
  }

  // Write full inventory
  fs.writeFileSync(path.join(QA_REPORT_DIR, 'inventory.json'), JSON.stringify(report, null, 2), 'utf8');

  // Write summary without items array for compact reading
  const summary: Partial<InventoryReport> = { ...report };
  delete summary.items;
  fs.writeFileSync(path.join(QA_REPORT_DIR, 'inventory-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log('Authoritative Inventory Generated:');
  console.log(`- Total Modules: ${report.totalModules}`);
  console.log(`- Total Activity Files: ${report.totalActivityFiles}`);
  console.log(`- Total Questions: ${report.totalQuestions}`);
  console.log(`- Questions with Images: ${report.questionsContainingImages}`);
  console.log(`- Questions with Options: ${report.questionsContainingOptions}`);
  console.log(`- Questions with Units: ${report.questionsContainingUnits}`);
  console.log(`- Questions with Expected Answers: ${report.questionsContainingExpectedAnswers}`);
  console.log('\nQuestions Per Module:');
  console.table(report.questionsPerModule);
  console.log('\nQuestions Per Activity Type:');
  console.table(report.questionsPerActivityType);

  return report;
}

if (process.argv[1]?.endsWith('generate-authoritative-inventory.ts')) {
  generateInventory();
}
