import * as fs from 'fs';
import * as path from 'path';
// @ts-expect-error - no types for xlsx
import * as xlsx from 'xlsx';
import {
  Activity,
  ActivityCategory,
  ActivityVariant,
  ActivityOption,
  EnglishModuleManifest,
  EnglishCurriculumManifest,
  EnglishDayAllocation,
  EnglishDifficultyBreakdown
} from '../src/types';

const ENG_SOURCE_DIR = path.resolve('docs/eng');
const OUT_DIR = path.resolve('src/content/class-3/english');
const ENG_IMAGES_ROOT = path.resolve('ENGLISH-IMAGES-20261004T082455Z-1-001/ENGLISH-IMAGES');
const PUBLIC_IMAGES_DIR = path.resolve('public/assets/class-3/english/images');

interface ModuleSourceConfig {
  module: number;
  filename: string;
  newWordsSheet: string;
  reviewSheet: string | null;
  title: string;
}

const MODULE_CONFIGS: ModuleSourceConfig[] = [
  {
    module: 1,
    filename: 'English_Module_1_120_Word_Implementation_Plan.xlsx',
    newWordsSheet: 'Module 1 - 120 Words',
    reviewSheet: null,
    title: 'Module 1 - Foundation & Recognition'
  },
  {
    module: 2,
    filename: 'English_Module_2_120_NEW_40_REVIEW_PROCESSED.xlsx',
    newWordsSheet: 'Module 2 - 120 New Words',
    reviewSheet: 'Module 2 - 40 Review',
    title: 'Module 2 - Phonemic Building & Core Vocabulary'
  },
  {
    module: 3,
    filename: 'English_Module_3_120_NEW_40_REVIEW_PROCESSED.xlsx',
    newWordsSheet: 'Module 3 - 120 New Words',
    reviewSheet: 'Module 3 - 40 Review',
    title: 'Module 3 - Structural Patterns & Blends'
  },
  {
    module: 4,
    filename: 'English_Module_4_120_NEW_40_REVIEW_PROCESSED.xlsx',
    newWordsSheet: 'Module 4 - 120 New Words',
    reviewSheet: 'Module 4 - 40 Review',
    title: 'Module 4 - Word Construction & Syllables'
  },
  {
    module: 5,
    filename: 'English_Module_5_120_NEW_40_REVIEW_PROCESSED.xlsx',
    newWordsSheet: 'Module 5 - 120 New Words',
    reviewSheet: 'Module 5 - 40 Review',
    title: 'Module 5 - Context & Extended Vocabulary'
  },
  {
    module: 6,
    filename: 'English_Module_6_120_NEW_40_REVIEW_PROCESSED.xlsx',
    newWordsSheet: 'Module 6 - 120 New Words',
    reviewSheet: 'Module 6 - 40 Review',
    title: 'Module 6 - Advanced Construction & Compounds'
  },
  {
    module: 7,
    filename: 'English_Module_7_120_NEW_40_REVIEW_PROCESSED.xlsx',
    newWordsSheet: 'Module 7 - 120 New Words',
    reviewSheet: 'Module 7 - 40 Review',
    title: 'Module 7 - Lexical Consolidation'
  },
  {
    module: 8,
    filename: 'English_Module_8_118_NEW_40_REVIEW_PROCESSED.xlsx',
    newWordsSheet: 'Module 8 - 118 New Words',
    reviewSheet: 'Module 8 - 40 Review',
    title: 'Module 8 - Curriculum Mastery'
  }
];

// Documented authoring anomalies that must not be silently fixed
const SOURCE_ANOMALIES: Record<string, string> = {
  EW114: '8 letter tokens provided for 6-letter word "cannot" (extra n, o)',
  EW249: 'Options string includes literal text "+ picture of a home"',
  EW262: '8 letter tokens provided for 7-letter word "evening" (extra g)',
  EW265: 'Multi-letter syllable chunks ("e d | l y | x c i t e") provided under E06 Arrange Letters',
  EW574: 'Only 5 letter tokens provided for 6-letter word "peeler" (missing e)',
  EW576: 'Only 5 letter tokens provided for 6-letter word "pepper" (missing p)',
  EW894: '8 letter tokens provided for 7-letter word "unhappy" (extra p, slash-delimited)',
  EW913: '7 letter tokens provided for 6-letter word "warned" (extra n)',
  EW943: '7 letter tokens provided for 6-letter word "wooden" (extra d)'
};

function readSheet(filePath: string, sheetName: string): Record<string, unknown>[] {
  const buf = fs.readFileSync(filePath);
  const wb = xlsx.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);
  return xlsx.utils.sheet_to_json(sheet);
}

function extractActivityCode(activityStr: string): string {
  const match = activityStr.match(/E\d+/);
  return match ? match[0] : activityStr.trim();
}

function normalizeDifficulty(rawDiff: unknown): { level: 1 | 2 | 3; sourceDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed' | 'Unclassified' } {
  const str = String(rawDiff || '').trim();
  const lower = str.toLowerCase();

  if (lower === 'easy') {
    return { level: 1, sourceDifficulty: 'Easy' };
  }
  if (lower === 'medium') {
    return { level: 2, sourceDifficulty: 'Medium' };
  }
  if (lower === 'hard') {
    return { level: 3, sourceDifficulty: 'Hard' };
  }
  if (lower === 'mixed') {
    return { level: 2, sourceDifficulty: 'Mixed' };
  }
  return { level: 2, sourceDifficulty: 'Unclassified' };
}

function normalizeActivityMapping(
  activityCode: string,
  rawOptions: string | undefined
): { category: ActivityCategory; variant: ActivityVariant } {
  switch (activityCode) {
    case 'E08':
      return { category: 'spelling-choice', variant: 'select' };

    case 'E06':
    case 'E04':
    case 'E07':
      return { category: 'arrange-word', variant: 'arrange' };

    case 'E05':
    case 'E11':
      return { category: 'word-completion', variant: 'missing-unit' };

    case 'E01':
      return { category: 'picture-recognition', variant: 'word-entry' };

    case 'E12': {
      const hasChoices = rawOptions && (rawOptions.includes('/') || rawOptions.includes('|'));
      return {
        category: 'picture-recognition',
        variant: hasChoices ? 'select' : 'word-entry'
      };
    }

    case 'E09':
      return { category: 'meaning-match', variant: 'word-entry' };

    default:
      console.warn(`Unmapped English activity code: ${activityCode}`);
      return { category: 'spelling-choice', variant: 'select' };
  }
}

function parseOptionsOrUnits(
  variant: ActivityVariant,
  rawStr: string | undefined
): { options?: ActivityOption[]; units?: string[]; template?: string } {
  if (!rawStr) return {};

  const trimmed = rawStr.trim();

  if (variant === 'select') {
    // Slash-delimited or pipe-delimited
    const delimiter = trimmed.includes('/') ? '/' : '|';
    const parts = trimmed.split(delimiter).map(p => p.trim()).filter(Boolean);
    const options: ActivityOption[] = parts.map((label, idx) => ({
      id: String.fromCharCode(65 + idx),
      label
    }));
    return { options };
  }

  if (variant === 'arrange') {
    // Pipe-delimited or slash-delimited (e.g. EW894)
    const delimiter = trimmed.includes('|') ? '|' : (trimmed.includes('/') ? '/' : '|');
    const units = trimmed.split(delimiter).map(p => p.trim()).filter(Boolean);
    const options: ActivityOption[] = units.map((label, idx) => ({
      id: String.fromCharCode(65 + idx),
      label
    }));
    return { units, options };
  }

  // For missing-unit, word-entry, or clues
  return { template: trimmed };
}

const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const CONSONANTS = ['b', 'c', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'w'];

function extractMissingLetter(template?: string, targetWord?: string, answer?: string): string {
  const cleanedTemplate = (template || '').replace(/[|\s]/g, '');
  const cleanedTarget = (targetWord || answer || '').replace(/\s+/g, '');
  let missing = '';
  for (let i = 0; i < cleanedTemplate.length && i < cleanedTarget.length; i++) {
    if (cleanedTemplate[i] === '_') {
      missing += cleanedTarget[i];
    }
  }
  return missing.toLowerCase() || (answer || '').toLowerCase();
}

function generateLetterDistractors(letter: string, seedStr: string): string[] {
  const isVowel = VOWELS.includes(letter);
  const pool = isVowel ? VOWELS.filter(v => v !== letter) : CONSONANTS.filter(c => c !== letter);
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const picked: string[] = [];
  for (let i = 0; i < pool.length && picked.length < 3; i++) {
    const idx = (hash + i * 3) % pool.length;
    const candidate = pool[idx];
    if (!picked.includes(candidate)) {
      picked.push(candidate);
    }
  }
  let i = 0;
  while (picked.length < 3 && i < pool.length) {
    if (!picked.includes(pool[i])) picked.push(pool[i]);
    i++;
  }
  return picked;
}

function generateWordDistractors(targetWord: string, pool: string[], seedStr: string): string[] {
  const filtered = pool.filter(w => w.toLowerCase() !== targetWord.toLowerCase());
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const picked: string[] = [];
  for (let i = 0; i < filtered.length && picked.length < 3; i++) {
    const idx = (hash + i * 7) % filtered.length;
    const candidate = filtered[idx];
    if (!picked.includes(candidate)) {
      picked.push(candidate);
    }
  }
  let i = 0;
  while (picked.length < 3 && i < filtered.length) {
    if (!picked.includes(filtered[i])) picked.push(filtered[i]);
    i++;
  }
  return picked;
}

function createActivityOptions(correctLabel: string, distractors: string[], seedStr: string): ActivityOption[] {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const pos = hash % 4;
  const labels = [...distractors];
  labels.splice(pos, 0, correctLabel);
  return labels.map((label, idx) => ({
    id: String.fromCharCode(65 + idx),
    label
  }));
}

const EXACT_TAMIL_MATCHES: Record<string, { tamilAssetId: string; path: string; alt: string }> = {
  'apple': { tamilAssetId: 'class3-tamil-picture-q003', path: '/assets/class-3/tamil/term-1/images/Q003_Pazham.jpg', alt: 'Apple — ஆப்பிள்' },
  'fruit': { tamilAssetId: 'class3-tamil-picture-q003', path: '/assets/class-3/tamil/term-1/images/Q003_Pazham.jpg', alt: 'Fruit — பழம்' },
  'bag': { tamilAssetId: 'class3-tamil-picture-q104', path: '/assets/class-3/tamil/term-1/images/Q104_Pai.jpg', alt: 'Bag — பை' },
  'box': { tamilAssetId: 'class3-tamil-picture-q101', path: '/assets/class-3/tamil/term-1/images/Q101_Petti.jpg', alt: 'Box — பெட்டி' },
  'dog': { tamilAssetId: 'class3-tamil-picture-q005', path: '/assets/class-3/tamil/term-1/images/Q005_Naai.jpg', alt: 'Dog — நாய்' },
  'rabbit': { tamilAssetId: 'class3-tamil-picture-q001', path: '/assets/class-3/tamil/term-1/images/Q001_Muyal.jpg', alt: 'Rabbit — முயல்' },
  'rat': { tamilAssetId: 'class3-tamil-picture-q013', path: '/assets/class-3/tamil/term-1/images/Q013_Eli.jpg', alt: 'Rat — எலி' },
  'shop': { tamilAssetId: 'class3-tamil-picture-q034', path: '/assets/class-3/tamil/term-1/images/Q034_Kadai.jpg', alt: 'Shop — கடை' },
  'colour': { tamilAssetId: 'class3-tamil-picture-q014', path: '/assets/class-3/tamil/term-1/images/Q014_Vannangal.jpg', alt: 'Colour — வண்ணங்கள்' }
};

function requiresPictureAsset(actCode: string, prompt: string, originalActivity: string): boolean {
  if (actCode === 'E01' || actCode === 'E12') return true;
  const lower = (prompt + ' ' + originalActivity).toLowerCase();
  return lower.includes('picture') || lower.includes('look at the picture');
}

function createAssetRequirement(activityId: string, ewId: string, targetWord: string, activityCode: string, prompt: string) {
  const wordKey = targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const assetId = `eng-${wordKey}`;
  const lowerPrompt = prompt.toLowerCase();
  
  // False positive check: prompt sentence mentions the noun "picture"
  let isTextOnly = false;
  if (activityCode === 'E04') isTextOnly = true;
  else if (activityCode === 'E06' && !lowerPrompt.includes('look at the picture')) isTextOnly = true;
  else if (activityCode === 'E08' && !lowerPrompt.includes('look at the picture')) isTextOnly = true;
  else if (activityCode === 'E05' && !lowerPrompt.includes('look at the picture')) isTextOnly = true;
  else if ((activityCode === 'E09' || activityCode === 'E11') && !lowerPrompt.includes('look at the picture')) isTextOnly = true;

  if (isTextOnly) {
    return {
      activityId,
      ewId,
      targetWord,
      activityCode,
      assetId,
      required: false,
      classification: 'TEXT_ONLY' as const,
      status: 'text_only' as const,
      prompt
    };
  }

  const tamilMatch = EXACT_TAMIL_MATCHES[targetWord.toLowerCase()];
  if (tamilMatch) {
    return {
      activityId,
      ewId,
      targetWord,
      activityCode,
      assetId,
      required: true,
      classification: 'REQUIRED' as const,
      status: 'mapped' as const,
      prompt,
      proposedPath: tamilMatch.path,
      reusedFromTamilAssetId: tamilMatch.tamilAssetId
    };
  }

  return {
    activityId,
    ewId,
    targetWord,
    activityCode,
    assetId,
    required: true,
    classification: 'REQUIRED' as const,
    status: 'missing' as const,
    prompt,
    proposedPath: `/assets/class-3/english/images/${assetId}.jpg`
  };
}

export interface IngestedEnglishContent {
  curriculumManifest: EnglishCurriculumManifest;
  moduleManifests: Record<number, EnglishModuleManifest>;
  moduleActivities: Record<number, Activity[]>;
  assetRequirements: {
    activityId: string;
    ewId: string;
    targetWord: string;
    activityCode: string;
    assetId: string;
    required: boolean;
    classification: 'REQUIRED' | 'TEXT_ONLY';
    status: 'mapped' | 'missing' | 'text_only';
    prompt: string;
    proposedPath?: string;
    reusedFromTamilAssetId?: string;
  }[];
}

export function importEnglishContent(): IngestedEnglishContent {
  console.log('Starting Class 3 English content ingestion...');

  // Step 1: Pre-scan to map each EW ID to its origin module and build module vocabulary pools
  const wordOriginModuleMap = new Map<string, number>();
  const moduleWordMap = new Map<number, string[]>();
  const allEnglishWords: string[] = [];

  MODULE_CONFIGS.forEach(cfg => {
    const filePath = path.join(ENG_SOURCE_DIR, cfg.filename);
    const rows = readSheet(filePath, cfg.newWordsSheet);
    const wordsInMod: string[] = [];
    rows.forEach(r => {
      const id = String(r['ID'] || r['EW ID'] || '').trim();
      const word = String(r['Target Word'] || '').trim().toLowerCase();
      if (id) {
        wordOriginModuleMap.set(id, cfg.module);
      }
      if (word && !wordsInMod.includes(word)) {
        wordsInMod.push(word);
        if (!allEnglishWords.includes(word)) {
          allEnglishWords.push(word);
        }
      }
    });
    moduleWordMap.set(cfg.module, wordsInMod);
  });

  console.log(`Pre-scanned ${wordOriginModuleMap.size} unique new words across 8 modules.`);

  const moduleActivities: Record<number, Activity[]> = {};
  const moduleManifests: Record<number, EnglishModuleManifest> = {};
  const assetRequirements: IngestedEnglishContent['assetRequirements'] = [];

  const overallDifficultyBreakdown: EnglishDifficultyBreakdown = {
    easy: 0,
    medium: 0,
    hard: 0,
    mixed: 0,
    unclassified: 0
  };

  let totalNewWords = 0;
  let totalReviewInstances = 0;

  // Step 2: Ingest each module
  MODULE_CONFIGS.forEach(cfg => {
    const filePath = path.join(ENG_SOURCE_DIR, cfg.filename);
    const newRows = readSheet(filePath, cfg.newWordsSheet);
    const reviewRows = cfg.reviewSheet ? readSheet(filePath, cfg.reviewSheet) : [];

    const activities: Activity[] = [];
    const modDiffBreakdown: EnglishDifficultyBreakdown = {
      easy: 0,
      medium: 0,
      hard: 0,
      mixed: 0,
      unclassified: 0
    };

    const daysMap = new Map<number, EnglishDayAllocation>();
    for (let d = 1; d <= 5; d++) {
      daysMap.set(d, { day: d, newCount: 0, reviewCount: 0, totalCount: 0 });
    }

    const categoriesSet = new Set<ActivityCategory>();

    // Process new words
    newRows.forEach(row => {
      const ewId = String(row['ID'] || row['EW ID'] || '').trim();
      if (!ewId) return;

      const targetWord = String(row['Target Word'] || '').trim().toLowerCase();
      const rawActivity = String(row['Activity Type'] || row['Existing Primary Activity'] || row['Activity Code'] || '').trim();
      const activityCode = extractActivityCode(rawActivity);

      const rawDiff = row['Difficulty'] || row['Difficulty Evidence'];
      const { level, sourceDifficulty } = normalizeDifficulty(rawDiff);

      // Track difficulty for new words
      modDiffBreakdown[sourceDifficulty.toLowerCase() as keyof EnglishDifficultyBreakdown]++;
      overallDifficultyBreakdown[sourceDifficulty.toLowerCase() as keyof EnglishDifficultyBreakdown]++;

      const rawOptions = row['Letters / Options / Word Parts'] !== undefined && row['Letters / Options / Word Parts'] !== null
        ? String(row['Letters / Options / Word Parts'])
        : undefined;

      const { category, variant } = normalizeActivityMapping(activityCode, rawOptions);
      categoriesSet.add(category);

      const parsed = parseOptionsOrUnits(variant, rawOptions);

      const prompt = String(row['Child-Facing Instruction / Clue'] || '').trim();
      const correctAnswer = String(row['Answer'] || '').trim();

      const day = Number(row['Day'] || row['Primary Day'] || 1);
      const dayAlloc = daysMap.get(day);
      if (dayAlloc) {
        dayAlloc.newCount++;
        dayAlloc.totalCount++;
      }

      const runtimeId = `ENG-M${cfg.module}-${ewId}`;
      const isAnomaly = ewId in SOURCE_ANOMALIES;

      let options = parsed.options;
      let units = parsed.units;

      if (!options || options.length === 0) {
        if (category === 'word-completion') {
          const missing = extractMissingLetter(parsed.template, targetWord, correctAnswer);
          const distractors = generateLetterDistractors(missing, runtimeId);
          options = createActivityOptions(missing, distractors, runtimeId);
          units = options.map(o => o.label);
        } else if (category === 'picture-recognition' || category === 'meaning-match') {
          const modPool = moduleWordMap.get(cfg.module) || allEnglishWords;
          const distractors = generateWordDistractors(targetWord, modPool.length >= 4 ? modPool : allEnglishWords, runtimeId);
          options = createActivityOptions(targetWord, distractors, runtimeId);
        }
      }

      const activity: Activity = {
        id: runtimeId,
        classLevel: 3,
        subject: 'English',
        language: 'en-IN',
        module: cfg.module,
        day,
        role: 'new',
        level,
        sourceDifficulty,
        targetWord,
        category,
        variant,
        prompt,
        options,
        units,
        template: parsed.template,
        correctAnswer,
        source: {
          workbook: cfg.filename,
          ewId,
          activityCode,
          originalActivity: rawActivity,
          hasSourceAnomaly: isAnomaly,
          anomalyNote: isAnomaly ? SOURCE_ANOMALIES[ewId] : undefined
        }
      };

      // Check asset requirement
      if (requiresPictureAsset(activityCode, prompt, rawActivity)) {
        assetRequirements.push(createAssetRequirement(runtimeId, ewId, targetWord, activityCode, prompt));
      }

      activities.push(activity);
      totalNewWords++;
    });

    // Process review words
    reviewRows.forEach(row => {
      const ewId = String(row['ID'] || row['EW ID'] || '').trim();
      if (!ewId) return;

      const targetWord = String(row['Target Word'] || '').trim().toLowerCase();
      const rawActivity = String(row['Activity Type'] || row['Existing Activity Type'] || '').trim();
      const activityCode = extractActivityCode(rawActivity);

      const rawDiff = row['Difficulty'] || row['Difficulty Evidence'] || row['Module 1 Difficulty'];
      const { level, sourceDifficulty } = normalizeDifficulty(rawDiff);

      const rawOptions = row['Letters / Options / Word Parts'] !== undefined && row['Letters / Options / Word Parts'] !== null
        ? String(row['Letters / Options / Word Parts'])
        : undefined;

      const { category, variant } = normalizeActivityMapping(activityCode, rawOptions);
      categoriesSet.add(category);

      const parsed = parseOptionsOrUnits(variant, rawOptions);

      const prompt = String(row['Child-Facing Instruction / Clue'] || '').trim();
      const correctAnswer = String(row['Answer'] || '').trim();

      const day = Number(row['Day'] || row['Review Day'] || 1);
      const dayAlloc = daysMap.get(day);
      if (dayAlloc) {
        dayAlloc.reviewCount++;
        dayAlloc.totalCount++;
      }

      const runtimeId = `ENG-M${cfg.module}-REV-${ewId}`;
      const originModule = wordOriginModuleMap.get(ewId);
      const isAnomaly = ewId in SOURCE_ANOMALIES;

      let options = parsed.options;
      let units = parsed.units;

      if (!options || options.length === 0) {
        if (category === 'word-completion') {
          const missing = extractMissingLetter(parsed.template, targetWord, correctAnswer);
          const distractors = generateLetterDistractors(missing, runtimeId);
          options = createActivityOptions(missing, distractors, runtimeId);
          units = options.map(o => o.label);
        } else if (category === 'picture-recognition' || category === 'meaning-match') {
          const modPool = moduleWordMap.get(cfg.module) || allEnglishWords;
          const distractors = generateWordDistractors(targetWord, modPool.length >= 4 ? modPool : allEnglishWords, runtimeId);
          options = createActivityOptions(targetWord, distractors, runtimeId);
        }
      }

      const activity: Activity = {
        id: runtimeId,
        classLevel: 3,
        subject: 'English',
        language: 'en-IN',
        module: cfg.module,
        day,
        role: 'review',
        reviewSourceModule: originModule,
        level,
        sourceDifficulty,
        targetWord,
        category,
        variant,
        prompt,
        options,
        units,
        template: parsed.template,
        correctAnswer,
        source: {
          workbook: cfg.filename,
          ewId,
          activityCode,
          originalActivity: rawActivity,
          hasSourceAnomaly: isAnomaly,
          anomalyNote: isAnomaly ? SOURCE_ANOMALIES[ewId] : undefined
        }
      };

      if (requiresPictureAsset(activityCode, prompt, rawActivity)) {
        assetRequirements.push(createAssetRequirement(runtimeId, ewId, targetWord, activityCode, prompt));
      }

      activities.push(activity);
      totalReviewInstances++;
    });

    moduleActivities[cfg.module] = activities;

    const newCount = newRows.length;
    const reviewCount = reviewRows.length;

    moduleManifests[cfg.module] = {
      classLevel: 3,
      subject: 'English',
      module: cfg.module,
      title: cfg.title,
      newWordCount: newCount,
      reviewWordCount: reviewCount,
      totalActivities: activities.length,
      days: Array.from(daysMap.values()),
      difficultyBreakdown: modDiffBreakdown,
      supportedCategories: Array.from(categoriesSet),
      version: '1.0.0'
    };
  });

  const curriculumManifest: EnglishCurriculumManifest = {
    classLevel: 3,
    subject: 'English',
    language: 'en-IN',
    totalUniqueWords: totalNewWords,
    totalReviewInstances,
    totalActivities: totalNewWords + totalReviewInstances,
    moduleCount: MODULE_CONFIGS.length,
    modules: MODULE_CONFIGS.map(cfg => {
      const manifest = moduleManifests[cfg.module];
      return {
        module: cfg.module,
        title: cfg.title,
        newWordCount: manifest.newWordCount,
        reviewWordCount: manifest.reviewWordCount,
        totalActivities: manifest.totalActivities
      };
    }),
    difficultyBreakdown: overallDifficultyBreakdown,
    version: '1.0.0',
    sourceVersion: 'Class 3 English Modules 1-8 Consolidated Verified Master',
    generatedDate: new Date().toISOString()
  };

  return {
    curriculumManifest,
    moduleManifests,
    moduleActivities,
    assetRequirements
  };
}

export function writeIngestedContent(ingested: IngestedEnglishContent): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Write curriculum manifest
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(ingested.curriculumManifest, null, 2),
    'utf-8'
  );

  // Write module folders
  for (let m = 1; m <= 8; m++) {
    const modDir = path.join(OUT_DIR, `module-${m}`);
    fs.mkdirSync(modDir, { recursive: true });

    fs.writeFileSync(
      path.join(modDir, 'activities.json'),
      JSON.stringify(ingested.moduleActivities[m], null, 2),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(modDir, 'manifest.json'),
      JSON.stringify(ingested.moduleManifests[m], null, 2),
      'utf-8'
    );
  }

  // ── START ASSET IMPORT FIX ──
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });

  // 1. Build Tamil baseline
  const manifestEntries: Record<string, { type: string; source: string; path: string; alt: string }> = {};
  for (const [word, match] of Object.entries(EXACT_TAMIL_MATCHES)) {
    const key = `eng-${word}`;
    manifestEntries[key] = {
      type: 'image',
      source: 'local',
      path: match.path,
      alt: match.alt
    };
  }

  // 2. Scan available English source images
  const sourceImageMap = new Map<string, string>(); // ewId -> source absolute path
  for (let m = 1; m <= 8; m++) {
    const modDir = path.join(ENG_IMAGES_ROOT, `Module_${m}`);
    if (fs.existsSync(modDir)) {
      const files = fs.readdirSync(modDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      // First pass: look for _1 variants
      for (const f of files) {
        if (f.includes('_1.')) {
          const m2 = f.match(/^(EW\d+)_/i);
          if (m2) sourceImageMap.set(m2[1].toUpperCase(), path.join(modDir, f));
        }
      }
      // Second pass: fallback if no _1 exists
      for (const f of files) {
        const m2 = f.match(/^(EW\d+)_/i);
        if (m2) {
          const ewId = m2[1].toUpperCase();
          if (!sourceImageMap.has(ewId)) sourceImageMap.set(ewId, path.join(modDir, f));
        }
      }
    }
  }

  // 3. Resolve required assets
  const processedAssetIds = new Set<string>();
  for (const entry of ingested.assetRequirements) {
    if (entry.classification === 'REQUIRED' && entry.status === 'missing') {
      const destFileName = `${entry.assetId}.jpg`;
      const destPath = path.join(PUBLIC_IMAGES_DIR, destFileName);
      const publicPath = `/assets/class-3/english/images/${destFileName}`;

      if (processedAssetIds.has(entry.assetId)) {
        // Already copied by a previous instance (e.g. original activity)
        entry.status = 'mapped';
        entry.resolvedPath = publicPath;
      } else {
        const sourcePath = sourceImageMap.get(entry.ewId);
        if (sourcePath) {
          fs.copyFileSync(sourcePath, destPath);
          manifestEntries[entry.assetId] = {
            type: 'image',
            source: 'local',
            path: publicPath,
            alt: `${entry.targetWord} — English vocabulary image`
          };
          entry.status = 'mapped';
          entry.resolvedPath = publicPath;
          processedAssetIds.add(entry.assetId);
        }
      }
    } else if (entry.status === 'mapped' && entry.reusedFromTamilAssetId) {
      // It's a Tamil reuse, just populate resolvedPath if needed
      entry.resolvedPath = entry.proposedPath;
    }
  }
  // ── END ASSET IMPORT FIX ──

  // Write asset requirements manifest
  fs.writeFileSync(
    path.join(OUT_DIR, 'assets.json'),
    JSON.stringify(ingested.assetRequirements, null, 2),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(OUT_DIR, 'asset-manifest.json'),
    JSON.stringify(manifestEntries, null, 2),
    'utf-8'
  );

  console.log(`Successfully written English content to ${OUT_DIR}`);
  console.log(`- Total Unique Words: ${ingested.curriculumManifest.totalUniqueWords}`);
  console.log(`- Total Review Instances: ${ingested.curriculumManifest.totalReviewInstances}`);
  console.log(`- Total Activities: ${ingested.curriculumManifest.totalActivities}`);
  console.log(`- Visual Asset Requirements: ${ingested.assetRequirements.length}`);
}

// Run CLI when invoked directly
if (process.argv[1] && (process.argv[1].endsWith('import-english.ts') || process.argv[1].endsWith('import-english.js'))) {
  const result = importEnglishContent();
  writeIngestedContent(result);
}
