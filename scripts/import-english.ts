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

// ── Source and output directories ──────────────────────────────────────────────
const ENG_SOURCE_DIR = path.resolve('updatedenglishspellingquestions');
const OUT_DIR = path.resolve('src/content/class-3/english');
const ENG_IMAGES_ROOT = path.resolve('ENGLISH-IMAGES-20261004T082455Z-1-001/ENGLISH-IMAGES');
const PUBLIC_IMAGES_DIR = path.resolve('public/assets/class-3/english/images');

// ── Module configuration: new XLSX files ────────────────────────────────────────
interface ModuleSourceConfig {
  module: number;
  filename: string;
  /** Primary data sheet for new words */
  newWordsSheet: string;
  /** Primary data sheet for review words (null for M1) */
  reviewSheet: string | null;
  title: string;
  /** Which schema to use when reading rows */
  schema: 'M1' | 'M2' | 'M3' | 'M4_plus';
}

const MODULE_CONFIGS: ModuleSourceConfig[] = [
  {
    module: 1,
    filename: 'English_Module_1_Module1_All_120_Questions_Options_for_Validation.xlsx',
    newWordsSheet: 'All 120 - Validation',
    reviewSheet: null,
    title: 'Module 1 - Foundation & Recognition',
    schema: 'M1'
  },
  {
    module: 2,
    filename: 'English_Module_2_All_160_Questions_Options_for_Validation.xlsx',
    newWordsSheet: 'All 160 - Validation',
    reviewSheet: null, // new+review in one flat sheet, split by Role column
    title: 'Module 2 - Phonemic Building & Core Vocabulary',
    schema: 'M2'
  },
  {
    module: 3,
    filename: 'English_Module_3_All_160_Questions_Options_for_Validation.xlsx',
    newWordsSheet: 'All 160 - Validation',
    reviewSheet: null, // new+review in one flat sheet
    title: 'Module 3 - Structural Patterns & Blends',
    schema: 'M3'
  },
  {
    module: 4,
    filename: 'English_Module_4_Picture_Support_Corrected_v2.xlsx',
    newWordsSheet: 'Module 4 - 120 New Words',
    reviewSheet: 'Module 4 - 40 Review',
    title: 'Module 4 - Word Construction & Syllables',
    schema: 'M4_plus'
  },
  {
    module: 5,
    filename: 'English_Module_5_Picture_and_Options_Support_Corrected_v1.xlsx',
    newWordsSheet: 'Module 5 - 120 New Words',
    reviewSheet: 'Module 5 - 40 Review',
    title: 'Module 5 - Context & Extended Vocabulary',
    schema: 'M4_plus'
  },
  {
    module: 6,
    filename: 'English_Module_6_Picture_and_Options_Support_Corrected_v1.xlsx',
    newWordsSheet: 'Module 6 - 120 New Words',
    reviewSheet: 'Module 6 - 40 Review',
    title: 'Module 6 - Advanced Construction & Compounds',
    schema: 'M4_plus'
  },
  {
    module: 7,
    filename: 'English_Module_7_Picture_and_Options_Support_Corrected_v2_FULL_WORD_LIST.xlsx',
    newWordsSheet: 'Module 7 - 120 New Words',
    reviewSheet: 'Module 7 - 40 Review',
    title: 'Module 7 - Lexical Consolidation',
    schema: 'M4_plus'
  },
  {
    module: 8,
    filename: 'English_Module_8_Picture_and_Options_Support_Corrected_v1_FULL_WORD_LIST.xlsx',
    newWordsSheet: 'Module 8 - 118 New Words',
    reviewSheet: 'Module 8 - 40 Review',
    title: 'Module 8 - Curriculum Mastery',
    schema: 'M4_plus'
  }
];

// ── Documented authoring anomalies ──────────────────────────────────────────────
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

// ── Normalized row type returned by schema readers ──────────────────────────────
interface NormalizedRow {
  ewId: string;
  targetWord: string;
  difficulty: unknown;
  activityCode: string;
  rawActivity: string;
  prompt: string;
  rawOptions: string | undefined;
  correctAnswer: string;
  day: number;
  role: 'new' | 'review';
  reviewSourceModule?: number;
  proposedOptions?: string; // E05 proposed missing-letter options
}

// ── Utility ─────────────────────────────────────────────────────────────────────

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
  if (lower === 'easy') return { level: 1, sourceDifficulty: 'Easy' };
  if (lower === 'medium') return { level: 2, sourceDifficulty: 'Medium' };
  if (lower === 'hard') return { level: 3, sourceDifficulty: 'Hard' };
  if (lower === 'mixed') return { level: 2, sourceDifficulty: 'Mixed' };
  return { level: 2, sourceDifficulty: 'Unclassified' };
}


/**
 * Detect whether rawOptions represent individual letter/syllable tiles for arrangement
 * vs word-level spelling choices.
 * Letter tiles: pipe-delimited, each token is 1-4 chars (single letters or short syllables).
 * Word choices: slash-delimited OR pipe-delimited tokens of >4 chars on average.
 */
function isLetterTileOptions(rawOptions: string): boolean {
  // Strip common prefixes like "Picture + jumbled letters:", "Jumbled letter tiles:", etc.
  const cleaned = rawOptions.replace(/^[^|/]+?(?:letter tiles|jumbled letters|word parts|syllables|tiles)\s*[:：]?\s*/i, '');
  // If only slashes and no pipes → word-choice format
  if (!cleaned.includes('|') && cleaned.includes('/')) return false;
  // Split by pipe
  const parts = cleaned.split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  // If average token length is ≤ 4 chars, treat as letter tiles
  const avgLen = parts.reduce((sum, p) => sum + p.length, 0) / parts.length;
  return avgLen <= 4;
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

    case 'E01': {
      // E01 is picture-recognition; if it has letter tiles for arrangement, use arrange
      if (rawOptions && isLetterTileOptions(rawOptions)) {
        return { category: 'arrange-word', variant: 'arrange' };
      }
      return { category: 'picture-recognition', variant: 'word-entry' };
    }

    case 'E12': {
      if (!rawOptions) return { category: 'picture-recognition', variant: 'word-entry' };
      // Slash-delimited full word choices → picture-recognition::select
      if (rawOptions.includes('/') && !rawOptions.includes('|')) {
        return { category: 'picture-recognition', variant: 'select' };
      }
      // Pipe-delimited letter tiles → arrange-word::arrange
      if (isLetterTileOptions(rawOptions)) {
        return { category: 'arrange-word', variant: 'arrange' };
      }
      // Mixed or ambiguous: pipe-delimited with longer tokens → select
      if (rawOptions.includes('/') || rawOptions.includes('|')) {
        return { category: 'picture-recognition', variant: 'select' };
      }
      return { category: 'picture-recognition', variant: 'word-entry' };
    }

    case 'E09':
      return { category: 'meaning-match', variant: 'word-entry' };

    default:
      console.warn(`Unmapped English activity code: ${activityCode}`);
      return { category: 'spelling-choice', variant: 'select' };
  }
}


/**
 * Parse the options/units from the raw options string.
 * For select: slash-delimited or pipe-delimited word choices
 * For arrange: pipe-delimited letter/syllable tiles
 * For missing-unit: template with underscore gaps
 */
function parseOptionsOrUnits(
  variant: ActivityVariant,
  rawStr: string | undefined,
  proposedOptions?: string
): { options?: ActivityOption[]; units?: string[]; template?: string } {
  // Prefer proposedOptions for word-completion (E05) when available
  const effectiveStr = (variant === 'missing-unit' && proposedOptions) ? proposedOptions : rawStr;

  if (!effectiveStr) return {};
  const trimmed = effectiveStr.trim();

  if (variant === 'select') {
    // Slash-delimited or pipe-delimited options
    const delimiter = trimmed.includes('/') ? '/' : '|';
    const parts = trimmed.split(delimiter).map(p => p.trim()).filter(Boolean);
    const options: ActivityOption[] = parts.map((label, idx) => ({
      id: String.fromCharCode(65 + idx),
      label
    }));
    return { options };
  }

  if (variant === 'arrange') {
    // Parse pipe-delimited or slash-delimited arrange tiles
    // Strip prefix text like "Jumbled letter tiles:" or "Picture + jumbled letters:"
    let cleaned = trimmed;
    // Remove common prefix patterns
    cleaned = cleaned.replace(/^.*?(?:jumbled letter tiles|jumbled letters|letter tiles|word parts|word part tiles|syllable tiles)\s*[:：]?\s*/i, '');
    // Also handle "_ _ _ | Jumbled letter tiles: t | a | r" pattern
    const pipeIdx = cleaned.indexOf('|');
    const underscoreOnly = /^[_\s]+$/.test(cleaned.substring(0, pipeIdx > 0 ? pipeIdx : cleaned.length));
    if (underscoreOnly && pipeIdx > 0) {
      cleaned = cleaned.substring(pipeIdx + 1);
    }

    const delimiter = cleaned.includes('|') ? '|' : (cleaned.includes('/') ? '/' : '|');
    const units = cleaned.split(delimiter).map(p => p.trim()).filter(p => p && p !== '_');
    if (units.length === 0) {
      // Fallback: try original rawStr
      const fallback = (rawStr || '').replace(/^.*?[:：]\s*/i, '');
      const fb = fallback.split(/[|/]/).map(p => p.trim()).filter(p => p && p !== '_');
      if (fb.length > 0) {
        const options: ActivityOption[] = fb.map((label, idx) => ({
          id: String.fromCharCode(65 + idx),
          label
        }));
        return { units: fb, options };
      }
    }
    const options: ActivityOption[] = units.map((label, idx) => ({
      id: String.fromCharCode(65 + idx),
      label
    }));
    return { units, options };
  }

  // For missing-unit and word-entry: use as template
  return { template: trimmed };
}

// ── Letter and word distractor generators (unchanged from original) ──────────────

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
    if (!picked.includes(candidate)) picked.push(candidate);
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
    if (!picked.includes(candidate)) picked.push(candidate);
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

// ── Tamil asset cross-references ────────────────────────────────────────────────

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

  let isTextOnly = false;
  if (activityCode === 'E04') isTextOnly = true;
  else if (activityCode === 'E06' && !lowerPrompt.includes('look at the picture')) isTextOnly = true;
  else if (activityCode === 'E08' && !lowerPrompt.includes('look at the picture')) isTextOnly = true;
  else if (activityCode === 'E05' && !lowerPrompt.includes('look at the picture')) isTextOnly = true;
  else if ((activityCode === 'E09' || activityCode === 'E11') && !lowerPrompt.includes('look at the picture')) isTextOnly = true;

  if (isTextOnly) {
    return {
      activityId, ewId, targetWord, activityCode, assetId,
      required: false,
      classification: 'TEXT_ONLY' as const,
      status: 'text_only' as const,
      prompt
    };
  }

  const tamilMatch = EXACT_TAMIL_MATCHES[targetWord.toLowerCase()];
  if (tamilMatch) {
    return {
      activityId, ewId, targetWord, activityCode, assetId,
      required: true,
      classification: 'REQUIRED' as const,
      status: 'mapped' as const,
      prompt,
      proposedPath: tamilMatch.path,
      reusedFromTamilAssetId: tamilMatch.tamilAssetId
    };
  }

  return {
    activityId, ewId, targetWord, activityCode, assetId,
    required: true,
    classification: 'REQUIRED' as const,
    status: 'missing' as const,
    prompt,
    proposedPath: `/assets/class-3/english/images/${assetId}.jpg`
  };
}

// ── Schema-specific row normalizers ─────────────────────────────────────────────

/**
 * Module 1: All 120 questions in one sheet.
 * Columns: No., Question ID, Target Word, Difficulty, Existing Activity Type,
 *          Exact Existing Instruction / Question, Existing Options / Word Parts / Picture Cue,
 *          Correct Answer (reviewer only), Proposed Game Presentation,
 *          Proposed Jumbled Letter Tiles (picture-write only), Validation Decision
 * No Day or Role column — all rows are 'new'; day assigned by position (24 per day).
 */
function normalizeM1Rows(rows: Record<string, unknown>[]): NormalizedRow[] {
  return rows.map((r, idx) => {
    const ewId = String(r['Question ID'] || '').trim();
    const targetWord = String(r['Target Word'] || '').trim().toLowerCase();
    const rawActivity = String(r['Existing Activity Type'] || '').trim();
    const activityCode = extractActivityCode(rawActivity);

    // Prompt: use instruction/question field
    const prompt = String(r['Exact Existing Instruction / Question'] || '').trim();

    // Options: prefer existing options field; for arrange activities, use Proposed Jumbled Letter Tiles
    let rawOptions = String(r['Existing Options / Word Parts / Picture Cue'] || '').trim();
    const proposedTiles = String(r['Proposed Jumbled Letter Tiles (picture-write only)'] || '').trim();

    // For picture-write activities (E01/E12 with arrangement), use proposed tiles if cue is a picture description or empty
    if (!rawOptions || /^picture\b/i.test(rawOptions) || (activityCode === 'E01' && proposedTiles)) {
      if (proposedTiles) {
        rawOptions = proposedTiles;
      }
    }

    const correctAnswer = String(r['Correct Answer (reviewer only)'] || '').trim();
    const difficulty = r['Difficulty'];
    // No Day column in M1 — assign 24 per day (rows 0-23 → day 1, etc.)
    const day = Math.min(5, Math.floor(idx / 24) + 1);

    return {
      ewId, targetWord, difficulty, activityCode, rawActivity,
      prompt, rawOptions: rawOptions || undefined, correctAnswer,
      day, role: 'new'
    };
  });
}

/**
 * Module 2: All 160 questions (new + review) in one flat sheet.
 * Columns: No., Question ID, Target Word, Difficulty, Role / Source Sheet,
 *          Existing Activity Type, Activity Code, Exact Existing Instruction / Clue,
 *          Existing Letters / Options / Word Parts, Correct Answer (reviewer only),
 *          Proposed Game Presentation, Proposed Missing-Letter Options (E05 only),
 *          Validation Status
 * Role column distinguishes new vs review.
 * No Day column — assign 24 new / 8 review per day (5 days).
 */
function normalizeM2Rows(rows: Record<string, unknown>[]): NormalizedRow[] {
  const newRows = rows.filter(r => String(r['Role / Source Sheet'] || '').toLowerCase().includes('new'));
  const revRows = rows.filter(r => String(r['Role / Source Sheet'] || '').toLowerCase().includes('review') || String(r['Role / Source Sheet'] || '').toLowerCase().includes('cumulative'));

  const result: NormalizedRow[] = [];

  newRows.forEach((r, idx) => {
    const ewId = String(r['Question ID'] || '').trim();
    const targetWord = String(r['Target Word'] || '').trim().toLowerCase();
    const rawActivity = String(r['Existing Activity Type'] || '').trim();
    const actCode = String(r['Activity Code'] || '').trim();
    const activityCode = actCode || extractActivityCode(rawActivity);
    const prompt = String(r['Exact Existing Instruction / Clue'] || '').trim();
    const rawOptions = String(r['Existing Letters / Options / Word Parts'] || '').trim() || undefined;
    const proposedOptions = String(r['Proposed Missing-Letter Options (E05 only)'] || '').trim() || undefined;
    const correctAnswer = String(r['Correct Answer (reviewer only)'] || '').trim();
    const difficulty = r['Difficulty'];
    const day = Math.min(5, Math.floor(idx / 24) + 1);

    result.push({
      ewId, targetWord, difficulty, activityCode, rawActivity,
      prompt, rawOptions, correctAnswer, day, role: 'new', proposedOptions
    });
  });

  revRows.forEach((r, idx) => {
    const ewId = String(r['Question ID'] || '').trim();
    const targetWord = String(r['Target Word'] || '').trim().toLowerCase();
    const rawActivity = String(r['Existing Activity Type'] || '').trim();
    const actCode = String(r['Activity Code'] || '').trim();
    const activityCode = actCode || extractActivityCode(rawActivity);
    const prompt = String(r['Exact Existing Instruction / Clue'] || '').trim();
    let rawOptions: string | undefined = String(r['Existing Letters / Options / Word Parts'] || '').trim() || undefined;
    const proposedTiles = String(r['Proposed Jumbled Letter Tiles (picture-write only)'] || '').trim();
    if (proposedTiles && (!rawOptions || /^picture\b/i.test(rawOptions) || activityCode === 'E01')) {
      rawOptions = proposedTiles;
    }
    const proposedOptions = String(r['Proposed Missing-Letter Options (E05 only)'] || '').trim() || undefined;
    const correctAnswer = String(r['Correct Answer (reviewer only)'] || '').trim();
    const difficulty = r['Difficulty'];
    const day = Math.min(5, Math.floor(idx / 8) + 1);

    result.push({
      ewId, targetWord, difficulty, activityCode, rawActivity,
      prompt, rawOptions, correctAnswer, day, role: 'review',
      reviewSourceModule: 1,
      proposedOptions
    });
  });

  return result;
}

/**
 * Module 3: All 160 questions in one flat sheet.
 * Columns: Target Word, Activity Type, Child-Facing Instruction / Clue,
 *          Letters / Options / Word Parts, Answer, ID, Module, Role, Source,
 *          Difficulty Evidence, Primary Activity Code, Day, Source Worksheet,
 *          Proposed Interaction Support, Proposed Letters / Options, Validation Note
 */
function normalizeM3Rows(rows: Record<string, unknown>[]): NormalizedRow[] {
  return rows.map(r => {
    const ewId = String(r['ID'] || r['Question ID'] || '').trim();
    const targetWord = String(r['Target Word'] || '').trim().toLowerCase();
    const rawActivity = String(r['Activity Type'] || '').trim();
    const actCode = String(r['Primary Activity Code'] || '').trim();
    const activityCode = actCode || extractActivityCode(rawActivity);
    const prompt = String(r['Child-Facing Instruction / Clue'] || '').trim();
    const rawOptions = String(r['Letters / Options / Word Parts'] || r['Proposed Letters / Options'] || '').trim() || undefined;
    const correctAnswer = String(r['Answer'] || '').trim();
    const difficulty = r['Difficulty Evidence'] || r['Difficulty'];
    const day = Number(r['Day'] || 1);
    const roleRaw = String(r['Role'] || '').toLowerCase();
    const role: 'new' | 'review' = roleRaw.includes('review') ? 'review' : 'new';
    const reviewSourceModule = role === 'review' ? 2 : undefined;

    return {
      ewId, targetWord, difficulty, activityCode, rawActivity,
      prompt, rawOptions, correctAnswer, day, role, reviewSourceModule
    };
  });
}

/**
 * Module 4-8: Separate sheets for new words and review.
 * Columns: Day, EW ID, Target Word, Difficulty, Activity Type,
 *          Child-Facing Instruction / Clue, Letters / Options / Word Parts, Answer,
 *          + various extra columns depending on module
 */
function normalizeM4PlusNewRows(rows: Record<string, unknown>[]): NormalizedRow[] {
  return rows.map(r => {
    const ewId = String(r['EW ID'] || r['ID'] || '').trim();
    const targetWord = String(r['Target Word'] || '').trim().toLowerCase();
    const rawActivity = String(r['Activity Type'] || '').trim();
    const activityCode = extractActivityCode(rawActivity);
    const prompt = String(r['Child-Facing Instruction / Clue'] || '').trim();

    // Prefer Proposed Letters / Options for E05 activities when available
    const proposedOptions = String(r['E05 Missing-Letter Options (Proposed)'] || r['E05 Options (Proposed)'] || r['Proposed Missing-Letter Options'] || '').trim() || undefined;
    const rawOptionsRaw = String(r['Letters / Options / Word Parts'] || r['Proposed Letters / Options'] || '').trim();
    const rawOptions = rawOptionsRaw || undefined;

    const correctAnswer = String(r['Answer'] || r['Answer (Adult Key)'] || '').trim();
    const difficulty = r['Difficulty'];
    const day = Number(r['Day'] || 1);

    return {
      ewId, targetWord, difficulty, activityCode, rawActivity,
      prompt, rawOptions, correctAnswer, day, role: 'new', proposedOptions
    };
  });
}

function normalizeM4PlusReviewRows(rows: Record<string, unknown>[], moduleNum: number): NormalizedRow[] {
  return rows.map(r => {
    const ewId = String(r['EW ID'] || r['ID'] || '').trim();
    const targetWord = String(r['Target Word'] || '').trim().toLowerCase();
    const rawActivity = String(r['Activity Type'] || '').trim();
    const activityCode = extractActivityCode(rawActivity);
    const prompt = String(r['Child-Facing Instruction / Clue'] || '').trim();

    const proposedOptions = String(r['Proposed Letters / Options'] || r['Proposed Missing-Letter Options'] || '').trim() || undefined;
    const rawOptionsRaw = String(r['Letters / Options / Word Parts'] || '').trim();
    const rawOptions = rawOptionsRaw || undefined;

    const correctAnswer = String(r['Answer'] || r['Answer (Adult Key)'] || '').trim();
    const difficulty = r['Difficulty'];
    const day = Number(r['Day'] || 1);

    // Determine review source module from "Previous Module" or module number
    const prevModStr = String(r['Previous Module'] || '').trim();
    let reviewSourceModule: number | undefined;
    if (prevModStr) {
      const match = prevModStr.match(/\d+/);
      if (match) reviewSourceModule = Number(match[0]);
    }
    if (!reviewSourceModule) reviewSourceModule = moduleNum - 1;

    return {
      ewId, targetWord, difficulty, activityCode, rawActivity,
      prompt, rawOptions, correctAnswer, day, role: 'review', reviewSourceModule,
      proposedOptions
    };
  });
}

// ── Main ingestion function ──────────────────────────────────────────────────────

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
    resolvedPath?: string;
  }[];
}

export function importEnglishContent(): IngestedEnglishContent {
  console.log('Starting Class 3 English content ingestion from updated source files...');
  console.log(`Source directory: ${ENG_SOURCE_DIR}`);

  // ── Pre-scan: build EW ID → origin module map and module word pools ──────────
  const wordOriginModuleMap = new Map<string, number>();
  const moduleWordMap = new Map<number, string[]>();
  const allEnglishWords: string[] = [];

  for (const cfg of MODULE_CONFIGS) {
    const filePath = path.join(ENG_SOURCE_DIR, cfg.filename);
    const rows = readSheet(filePath, cfg.newWordsSheet);
    const wordsInMod: string[] = [];

    rows.forEach(r => {
      const id = String(r['Question ID'] || r['EW ID'] || r['ID'] || '').trim();
      const word = String(r['Target Word'] || '').trim().toLowerCase();
      if (id) wordOriginModuleMap.set(id, cfg.module);
      if (word && !wordsInMod.includes(word)) {
        wordsInMod.push(word);
        if (!allEnglishWords.includes(word)) allEnglishWords.push(word);
      }
    });

    moduleWordMap.set(cfg.module, wordsInMod);
  }

  console.log(`Pre-scanned ${wordOriginModuleMap.size} unique new words across ${MODULE_CONFIGS.length} modules.`);

  const moduleActivities: Record<number, Activity[]> = {};
  const moduleManifests: Record<number, EnglishModuleManifest> = {};
  const assetRequirements: IngestedEnglishContent['assetRequirements'] = [];

  const overallDifficultyBreakdown: EnglishDifficultyBreakdown = {
    easy: 0, medium: 0, hard: 0, mixed: 0, unclassified: 0
  };

  let totalNewWords = 0;
  let totalReviewInstances = 0;

  // ── Ingest each module ────────────────────────────────────────────────────────
  for (const cfg of MODULE_CONFIGS) {
    const filePath = path.join(ENG_SOURCE_DIR, cfg.filename);
    console.log(`\nIngesting Module ${cfg.module}: ${cfg.filename}`);

    // Get normalized rows for this module
    let normalizedRows: NormalizedRow[];

    if (cfg.schema === 'M1') {
      const rows = readSheet(filePath, cfg.newWordsSheet);
      normalizedRows = normalizeM1Rows(rows);
    } else if (cfg.schema === 'M2') {
      const rows = readSheet(filePath, cfg.newWordsSheet);
      normalizedRows = normalizeM2Rows(rows);
    } else if (cfg.schema === 'M3') {
      const rows = readSheet(filePath, cfg.newWordsSheet);
      normalizedRows = normalizeM3Rows(rows);
    } else {
      // M4_plus: separate sheets
      const newRows = readSheet(filePath, cfg.newWordsSheet);
      const revRows = cfg.reviewSheet ? readSheet(filePath, cfg.reviewSheet) : [];
      normalizedRows = [
        ...normalizeM4PlusNewRows(newRows),
        ...normalizeM4PlusReviewRows(revRows, cfg.module)
      ];
    }

    const activities: Activity[] = [];
    const modDiffBreakdown: EnglishDifficultyBreakdown = {
      easy: 0, medium: 0, hard: 0, mixed: 0, unclassified: 0
    };

    const daysMap = new Map<number, EnglishDayAllocation>();
    for (let d = 1; d <= 5; d++) {
      daysMap.set(d, { day: d, newCount: 0, reviewCount: 0, totalCount: 0 });
    }

    const categoriesSet = new Set<ActivityCategory>();

    for (const row of normalizedRows) {
      const { ewId, targetWord, difficulty, activityCode, rawActivity, prompt, rawOptions, correctAnswer, day, role, reviewSourceModule, proposedOptions } = row;

      if (!ewId) continue;

      const { level, sourceDifficulty } = normalizeDifficulty(difficulty);

      if (role === 'new') {
        modDiffBreakdown[sourceDifficulty.toLowerCase() as keyof EnglishDifficultyBreakdown]++;
        overallDifficultyBreakdown[sourceDifficulty.toLowerCase() as keyof EnglishDifficultyBreakdown]++;
      }

      const { category, variant } = normalizeActivityMapping(activityCode, rawOptions);
      categoriesSet.add(category);

      const parsed = parseOptionsOrUnits(variant, rawOptions, proposedOptions);

      const dayAlloc = daysMap.get(day);
      if (dayAlloc) {
        if (role === 'new') { dayAlloc.newCount++; dayAlloc.totalCount++; }
        else { dayAlloc.reviewCount++; dayAlloc.totalCount++; }
      }

      const runtimeId = role === 'new'
        ? `ENG-M${cfg.module}-${ewId}`
        : `ENG-M${cfg.module}-REV-${ewId}`;

      const isAnomaly = ewId in SOURCE_ANOMALIES;

      let options = parsed.options;
      let units = parsed.units;

      // Auto-generate options when missing
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

      const originModule = role === 'review' ? (reviewSourceModule ?? wordOriginModuleMap.get(ewId)) : undefined;

      const activity: Activity = {
        id: runtimeId,
        classLevel: 3,
        subject: 'English',
        language: 'en-IN',
        module: cfg.module,
        day,
        role,
        ...(role === 'review' && { reviewSourceModule: originModule }),
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

      // Track asset requirements for picture activities
      if (requiresPictureAsset(activityCode, prompt, rawActivity)) {
        assetRequirements.push(createAssetRequirement(runtimeId, ewId, targetWord, activityCode, prompt));
      }

      activities.push(activity);

      if (role === 'new') totalNewWords++;
      else totalReviewInstances++;
    }

    moduleActivities[cfg.module] = activities;

    const newCount = activities.filter(a => a.role === 'new').length;
    const reviewCount = activities.filter(a => a.role === 'review').length;

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
      version: '2.0.0'
    };

    console.log(`  Module ${cfg.module}: ${newCount} new + ${reviewCount} review = ${activities.length} activities`);
  }

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
    version: '2.0.0',
    sourceVersion: 'Class 3 English Updated Spelling Questions (updatedenglishspellingquestions v2)',
    generatedDate: new Date().toISOString()
  };

  console.log(`\nIngestion complete:`);
  console.log(`  Total unique new words: ${totalNewWords}`);
  console.log(`  Total review instances: ${totalReviewInstances}`);
  console.log(`  Total activities: ${totalNewWords + totalReviewInstances}`);

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

  // ── Asset import ──────────────────────────────────────────────────────────────
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });

  // Build Tamil baseline
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

  // Scan available English source images
  const sourceImageMap = new Map<string, string>(); // ewId -> source absolute path
  for (let m = 1; m <= 8; m++) {
    const modDir = path.join(ENG_IMAGES_ROOT, `Module_${m}`);
    if (fs.existsSync(modDir)) {
      const files = fs.readdirSync(modDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      // First pass: prefer _1 variants
      for (const f of files) {
        if (f.includes('_1.')) {
          const m2 = f.match(/^(EW\d+)_/i);
          if (m2) sourceImageMap.set(m2[1].toUpperCase(), path.join(modDir, f));
        }
      }
      // Second pass: fallback
      for (const f of files) {
        const m2 = f.match(/^(EW\d+)_/i);
        if (m2) {
          const ewId = m2[1].toUpperCase();
          if (!sourceImageMap.has(ewId)) sourceImageMap.set(ewId, path.join(modDir, f));
        }
      }
    }
  }

  // Resolve required assets
  const processedAssetIds = new Set<string>();
  for (const entry of ingested.assetRequirements) {
    if (entry.classification === 'REQUIRED' && entry.status === 'missing') {
      const destFileName = `${entry.assetId}.jpg`;
      const destPath = path.join(PUBLIC_IMAGES_DIR, destFileName);
      const publicPath = `/assets/class-3/english/images/${destFileName}`;

      if (processedAssetIds.has(entry.assetId)) {
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
      entry.resolvedPath = entry.proposedPath;
    }
  }

  // Write asset manifests
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

  console.log(`\nSuccessfully written English content to ${OUT_DIR}`);
  console.log(`  Total Unique Words: ${ingested.curriculumManifest.totalUniqueWords}`);
  console.log(`  Total Review Instances: ${ingested.curriculumManifest.totalReviewInstances}`);
  console.log(`  Total Activities: ${ingested.curriculumManifest.totalActivities}`);
  console.log(`  Visual Asset Requirements: ${ingested.assetRequirements.length}`);
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (process.argv[1] && (process.argv[1].endsWith('import-english.ts') || process.argv[1].endsWith('import-english.js'))) {
  const result = importEnglishContent();
  writeIngestedContent(result);
}
