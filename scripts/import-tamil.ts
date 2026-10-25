import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import {
  Activity,
  ActivityCategory,
  ActivityVariant,
  ActivityOption,
  ContentManifest
} from '../src/types';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const WORKBOOK_FILE = path.resolve('Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx');
const SOURCE_DIR = path.resolve('tamil_json_by_module_activity');
const INDEX_FILE = path.join(SOURCE_DIR, 'index.json');
const OUT_DIR = path.resolve('src/content/class-3/tamil');
const TERM1_ASSETS_FILE = path.resolve('src/content/class-3/tamil/term-1/assets.json');
const EXISTING_ACTIVITIES_FILE = path.join(OUT_DIR, 'activities.json');

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

export function normalizeTamilCategory(original: string): { category: ActivityCategory; variant: ActivityVariant } {
  const norm = (original || '').trim();
  switch (norm) {
    case 'Picture → Select':
    case 'Picture → Context/Select':
      return { category: 'picture-recognition', variant: 'select' };

    case 'Drag & Drop Missing Unit':
    case 'Drag & Drop Missing Ending':
    case 'Picture → Missing Unit':
    case 'Missing Letter':
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
    case 'Context → Select':
      return { category: 'context-choice', variant: 'fill-blank' };

    case 'English Meaning → Tamil Word':
      return { category: 'meaning-match', variant: 'translate-select' };

    default:
      console.warn(`Unknown Tamil activity mapping: "${original}". Falling back to spelling-choice::select`);
      return { category: 'spelling-choice', variant: 'select' };
  }
}

function parseLevel(levelStr?: string | null): number {
  if (!levelStr) return 1;
  const l = levelStr.toLowerCase();
  if (l.includes('easy')) return 1;
  if (l.includes('medium')) return 2;
  if (l.includes('hard')) return 3;
  return 1;
}

function parseModuleNumber(modStr?: string | null): number {
  if (!modStr) return 1;
  const m = modStr.match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

function splitDelimited(str?: string): string[] {
  if (!str) return [];
  // Split by pipe or slash if pipe is absent
  const delimiter = str.includes('|') ? '|' : (str.includes('/') ? '/' : '|');
  return str.split(delimiter).map(s => s.trim()).filter(Boolean);
}

export function normalizeRecord(rec: RawRecord, manifest?: Record<string, unknown>): Activity {
  const sourceId = rec['Source ID'] || rec['Question ID'] || rec['FTS ID'] || `REC_${rec['Master Sequence']}`;
  const rawActivity = (rec['Activity'] || '').trim();
  let { category, variant } = normalizeTamilCategory(rawActivity);
  if (category === 'picture-recognition' && !rec.image?.path && (rec['Picture Required'] || '').toLowerCase() === 'no') {
    category = 'spelling-choice';
    variant = 'select';
  }
  const moduleNum = parseModuleNumber(rec['Module']);
  const levelNum = parseLevel(rec['Level']);
  const targetWord = rec['Target Word']?.trim() || '';
  const correctAnswer = rec['Correct Answer']?.trim() || targetWord;
  const rawInstruction = (rec['Question / Instruction'] || '').trim();

  let prompt = rawInstruction;
  let template: string | undefined;
  const rawOptionsUnits = rec['Options / Units'];
  const tokens = splitDelimited(rawOptionsUnits);

  // Apply targeted content fixes
  if (sourceId === 'Q090') {
    const idx = tokens.indexOf('பதட்டம்');
    if (idx !== -1) tokens[idx] = 'பதற்றல்';
  } else if (sourceId === 'Q073') {
    const idx = tokens.indexOf('தோன்றுகிற');
    if (idx !== -1) tokens[idx] = 'தோன்றின';
  } else if (sourceId === 'Q042') {
    const idx = tokens.indexOf('கவி');
    if (idx !== -1) tokens[idx] = 'கவிதை';
  } else if (sourceId === 'Q060') {
    prompt = 'ஒரு வேலையைச் செய்ய ஒருவருக்குத் தேவையான கல்வி மற்றும் அனுபவத்தை ______ என்பார்கள்.';
    const idx = tokens.indexOf('திறமை');
    if (idx !== -1) tokens[idx] = 'வளர்ச்சி';
  } else if (sourceId === 'Q065') {
    const idx = tokens.indexOf('பயம்');
    if (idx !== -1) tokens[idx] = 'பயணம்';
  } else if (sourceId === 'Q050') {
    const idx = tokens.indexOf('கூடை');
    if (idx !== -1) tokens[idx] = 'கூட்டு';
  } else if (sourceId === 'Q006') {
    const idx = tokens.findIndex(t => t === 'மண்' || t === 'மண');
    if (idx !== -1) tokens[idx] = 'மன';
  } else if (sourceId === 'Q025') {
    tokens.length = 0;
    tokens.push('வா', 'லி', 'னொ');
  } else if (sourceId === 'FTS0171') {
    const idx = tokens.indexOf('ற்');
    if (idx !== -1) tokens[idx] = 'லை';
  } else if (sourceId === 'FTS0614') {
    if (tokens.length >= 4 && tokens[3] === 'நிந்தனை') {
      tokens[3] = 'நிந்தலை';
    }
  } else if (sourceId === 'FTS0677') {
    const idx = tokens.indexOf('ர');
    if (idx !== -1) tokens[idx] = 'ரி';
  }

  if (category === 'word-completion') {
    // If prompt has __ but no [blank], replace underscores with [blank]
    if (prompt.includes('__') && !prompt.includes('[blank]')) {
      prompt = prompt.replace(/_{2,}/g, '[blank]');
    }

    // Set template for WordCompletionEvaluator
    const matchingOption = tokens.find(t => targetWord.includes(t));
    if (matchingOption) {
      template = targetWord.replace(matchingOption, '_');
    } else {
      const prefixMatch = prompt.match(/([^\s—–]+)\[blank\]/);
      if (prefixMatch) {
        template = prefixMatch[1] + '_';
      }
    }
  }

  let options: ActivityOption[] | undefined;
  let units: string[] | undefined;

  if (category === 'arrange-word') {
    units = tokens;
    // Map units to numbered option tokens for ArrangeWordActivity
    options = units.map((u, i) => ({
      id: String(i + 1),
      label: u
    }));
  } else {
    // Multiple-choice options
    options = tokens.map((optText, i) => ({
      id: String.fromCharCode(65 + i),
      label: optText
    }));
  }

  // Image handling
  let imageAssetId: string | undefined;
  const picAssetId = `class3-tamil-picture-${sourceId.toLowerCase()}`;
  if (rec.image?.path) {
    imageAssetId = picAssetId;
  } else if (rawActivity.includes('Picture') || prompt.includes('படத்தில்') || category === 'picture-recognition') {
    if (manifest && (manifest[picAssetId] || manifest[sourceId.toLowerCase()])) {
      imageAssetId = picAssetId;
    }
  }

  const activity: Activity = {
    id: sourceId,
    classLevel: 3,
    subject: 'Tamil',
    language: 'ta-IN',
    module: moduleNum,
    level: levelNum,
    targetWord: targetWord,
    category,
    variant,
    prompt: prompt || targetWord,
    correctAnswer,
    learningObjective: `${rawActivity} recognition and practice for ${targetWord}`,
    source: {
      workbook: rec['Source File'] || 'tamil_json_by_module_activity',
      questionId: rec['Question ID'] || sourceId,
      ftsId: rec['FTS ID'] || undefined,
      originalActivity: rawActivity
    },
    metadata: {
      positionInModule: rec['Position in Module'],
      masterSequence: rec['Master Sequence'],
      sourceBatch: rec['Source Batch'],
      sourceMeaningNotes: rec['Source Meaning / Notes'],
      sourceReferenceContext: rec['Source Reference / Context'],
      pictureSpecification: rec['Picture Specification'],
      verificationFlag: rec['Verification Flag'],
      imageMeta: rec.image || null
    }
  };

  if (options && options.length > 0) {
    activity.options = options;
  }
  if (units && units.length > 0) {
    activity.units = units;
  }
  if (template) {
    activity.template = template;
  }
  if (imageAssetId) {
    activity.image = {
      type: 'image',
      source: imageAssetId,
      alt: targetWord
    };
    activity.needsImage = true;
  }

  return activity;
}

export function importTamilContent() {
  console.log('Loading Tamil dataset with main source workbook:', WORKBOOK_FILE);

  if (!fs.existsSync(WORKBOOK_FILE)) {
    throw new Error(`Main source workbook not found at ${WORKBOOK_FILE}`);
  }

  // Load existing activities to preserve verified prompt rewrites, distractors, and needsImage overrides
  const existingActivitiesMap = new Map<string, Activity>();
  if (fs.existsSync(EXISTING_ACTIVITIES_FILE)) {
    try {
      const existing: Activity[] = JSON.parse(fs.readFileSync(EXISTING_ACTIVITIES_FILE, 'utf8'));
      for (const act of existing) {
        existingActivitiesMap.set(act.id, act);
      }
    } catch (e) {
      console.warn('Could not read existing activities for overrides preservation:', e);
    }
  }

  // Load asset manifest from existing verified asset-manifest.json
  const assetManifest: Record<string, { type: 'image' | 'audio'; source: 'local'; path: string; alt?: string; [k: string]: unknown }> = {};
  const currentAssetManifestFile = path.join(OUT_DIR, 'asset-manifest.json');
  if (fs.existsSync(currentAssetManifestFile)) {
    const curManifest = JSON.parse(fs.readFileSync(currentAssetManifestFile, 'utf8'));
    Object.assign(assetManifest, curManifest);
  }

  const wb = xlsx.readFile(WORKBOOK_FILE);
  const allActivities: Activity[] = [];
  const moduleActivitiesMap = new Map<number, Activity[]>();

  // Process all 8 modules in strict curriculum sequence (Position in Module 1..N from workbook sheets)
  for (let modNum = 1; modNum <= 8; modNum++) {
    const sheetName = `Module ${modNum}`;
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      throw new Error(`Sheet ${sheetName} not found in workbook ${WORKBOOK_FILE}`);
    }
    const rows: RawRecord[] = xlsx.utils.sheet_to_json(ws);
    const modActivities: Activity[] = [];

    for (let pos = 0; pos < rows.length; pos++) {
      const row = rows[pos];
      const sourceId = (row['Source ID'] || row['Question ID'] || row['FTS ID'] || `REC_${row['Master Sequence']}`) as string;
      const existing = existingActivitiesMap.get(sourceId);

      if (existing) {
        // Update module & workbook metadata from current workbook sheet row
        const updatedActivity: Activity = {
          ...existing,
          module: modNum,
          source: {
            ...existing.source,
            workbook: 'Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx',
            questionId: (row['Question ID'] || sourceId) as string,
            ftsId: (row['FTS ID'] || (sourceId.startsWith('FTS') ? sourceId : undefined)) as string | undefined,
            originalActivity: ((row['Activity'] as string) || '').trim()
          },
          metadata: {
            ...existing.metadata,
            positionInModule: (row['Position in Module'] ?? (pos + 1)) as number,
            masterSequence: (row['Master Sequence'] ?? (allActivities.length + 1)) as number,
            sourceBatch: row['Source Batch'] as string | undefined,
            sourceMeaningNotes: (row['Source Meaning / Notes'] ?? null) as string | number | null,
            sourceReferenceContext: (row['Source Reference / Context'] ?? null) as string | null,
            pictureSpecification: (row['Picture Specification'] ?? undefined) as string | undefined,
            verificationFlag: (row['Verification Flag'] ?? null) as string | null
          }
        };

        modActivities.push(updatedActivity);
        allActivities.push(updatedActivity);
      } else {
        const normalized = normalizeRecord(row, assetManifest);
        normalized.module = modNum;
        normalized.source = {
          ...normalized.source,
          workbook: 'Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx',
          questionId: (row['Question ID'] || sourceId) as string,
          ftsId: (row['FTS ID'] || (sourceId.startsWith('FTS') ? sourceId : undefined)) as string | undefined,
          originalActivity: ((row['Activity'] as string) || '').trim()
        };
        normalized.metadata = {
          ...normalized.metadata,
          positionInModule: (row['Position in Module'] ?? (pos + 1)) as number,
          masterSequence: (row['Master Sequence'] ?? (allActivities.length + 1)) as number,
          sourceBatch: row['Source Batch'] as string | undefined,
          sourceMeaningNotes: (row['Source Meaning / Notes'] ?? null) as string | number | null,
          sourceReferenceContext: (row['Source Reference / Context'] ?? null) as string | null,
          pictureSpecification: (row['Picture Specification'] ?? undefined) as string | undefined,
          verificationFlag: (row['Verification Flag'] ?? null) as string | null
        };
        modActivities.push(normalized);
        allActivities.push(normalized);
      }
    }

    moduleActivitiesMap.set(modNum, modActivities);
  }

  console.log(`Total normalized Tamil activities: ${allActivities.length}`);
  console.log(`Total image assets registered in manifest: ${Object.keys(assetManifest).length}`);

  // Write output files
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // 1. Unified activities.json
  fs.writeFileSync(
    path.join(OUT_DIR, 'activities.json'),
    JSON.stringify(allActivities, null, 2),
    'utf8'
  );

  // 2. Asset manifest
  fs.writeFileSync(
    path.join(OUT_DIR, 'asset-manifest.json'),
    JSON.stringify(assetManifest, null, 2),
    'utf8'
  );

  // 3. Curriculum manifest
  const manifest: ContentManifest = {
    classLevel: 3,
    subject: 'Tamil',
    language: 'ta-IN',
    version: '2.0.0',
    sourceVersion: 'Tamil Fresh Source Word List Final 1059 (Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx)',
    generatedDate: new Date().toISOString(),
    activityCount: allActivities.length,
    supportedCategories: [
      'picture-recognition',
      'word-completion',
      'arrange-word',
      'spelling-choice',
      'context-choice',
      'meaning-match'
    ]
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  // 4. Per-module folders
  for (const [modNum, acts] of moduleActivitiesMap.entries()) {
    const modDir = path.join(OUT_DIR, `module-${modNum}`);
    if (!fs.existsSync(modDir)) {
      fs.mkdirSync(modDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(modDir, 'activities.json'),
      JSON.stringify(acts, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(modDir, 'manifest.json'),
      JSON.stringify({
        module: modNum,
        classLevel: 3,
        subject: 'Tamil',
        activityCount: acts.length
      }, null, 2),
      'utf8'
    );
  }

  console.log('Tamil content successfully imported and written to:', OUT_DIR);
  return { allActivities, manifest, assetManifest };
}

// Execute if run directly from CLI
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/import-tamil.ts');
if (isDirectRun) {
  importTamilContent();
}
