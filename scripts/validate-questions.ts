import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { LocalContentRepository } from '../src/repositories/implementations/LocalContentRepository';
import { activityRegistry } from '../src/engine/ActivityRegistry';
import { registerCoreActivities } from '../src/features/Activity/registerActivities';
import { AssetResolver, getDefaultManifest } from '../src/engine/assets/AssetResolver';
import { combineTamilSandhi, matchesTamilOrTarget } from '../src/utils/tamil';
import { Activity } from '../src/types';

const require = createRequire(import.meta.url);
const englishWordsList: string[] = require('an-array-of-english-words');
const englishWordsSet = new Set(englishWordsList.map((w: string) => w.toLowerCase()));

// Load 20k common words list
const commonWordsPath = path.resolve('scripts/google-20k-words.txt');
const commonWordsSet = new Set<string>();
if (fs.existsSync(commonWordsPath)) {
  const lines = fs.readFileSync(commonWordsPath, 'utf8').split(/\r?\n/);
  for (const l of lines) {
    const w = l.trim().toLowerCase();
    if (w) commonWordsSet.add(w);
  }
}
// Ensure key common words
commonWordsSet.add('wasp');
commonWordsSet.add('swap');
commonWordsSet.add('paws');

// Pre-index dictionary words (>= 3 letters in 20k common words) by sorted letters
const commonAnagramMap = new Map<string, string[]>();
for (const w of englishWordsList) {
  const lw = w.toLowerCase();
  if (lw.length >= 3 && commonWordsSet.has(lw)) {
    const s = lw.split('').sort().join('');
    if (!commonAnagramMap.has(s)) {
      commonAnagramMap.set(s, []);
    }
    commonAnagramMap.get(s)!.push(lw);
  }
}

function hasMeaningClue(prompt: string): boolean {
  if (!prompt) return false;
  if (prompt.includes('_')) return true;
  const clean = prompt
    .replace(/look at the picture\.?/gi, '')
    .replace(/arrange the (?:letters|word parts|parts)(?: in (?:the )?(?:correct )?order)?(?: to (?:make|spell) the (?:correct )?word)?(?: and find the word)?\.?:?/gi, '')
    .replace(/put the (?:letters|word parts|parts) in the (?:correct )?order:?/gi, '')
    .replace(/choose the correct word and write it\.?:?/gi, '')
    .replace(/choose the correct (?:word|spelling)\.?:?/gi, '')
    .replace(/write the word\.?:?/gi, '')
    .replace(/write the name of (?:the|this) (?:food grain|body parts|vegetable|fruit|animal)\.?:?/gi, '')
    .replace(/find the word\.?:?/gi, '')
    .trim();
  return clean.length >= 10;
}

// Register core activities in the activity registry
registerCoreActivities();

export interface ValidationIssue {
  code: string;
  activityId: string;
  subject?: string;
  details: string;
}

export interface ValidationSummary {
  NO_BLANK_TEMPLATE: string[];
  UNSOLVABLE: string[];
  MULTIPLE_CORRECT: string[];
  IMAGE_MISSING: string[];
  STALE_TEMPLATE: string[];
  EXTRA_TILES: string[];
  DUPLICATE_IMAGE: string[];
  DUPLICATE_ID: string[];
  REAL_WORD_DISTRACTOR: string[];
  IMAGE_LOST: string[];
  PROMPT_MENTIONS_PICTURE: string[];
  ANAGRAM_ALTERNATIVE: string[];
  MISSING_ATTRIBUTION: string[];
  BLOCKED_IMAGE: string[];
  UNLICENSED_IMAGE: string[];
}

/**
 * Searches for any permutation of arrange tiles that satisfies the evaluator.
 */
function isArrangeSolvable(tiles: { id: string; label: string }[], evaluator: any, act: Activity): boolean {
  // Fast path: default ordering
  const defaultIds = tiles.map(t => t.id);
  if (evaluator.evaluate(act, defaultIds).correct) {
    return true;
  }

  const n = tiles.length;
  const used = new Array(n).fill(false);
  const currentLabels: string[] = [];
  const currentIds: string[] = [];
  const targetAns = Array.isArray(act.correctAnswer) ? act.correctAnswer : [act.correctAnswer || ''];
  const isTamil = act.subject === 'Tamil';

  // Fast character set verification for English
  if (!isTamil) {
    const tileLetters = tiles.map(t => t.label).join('').replace(/[\s\-_]/g, '').toLowerCase().split('').sort().join('');
    const hasMatchingTargetCharSet = targetAns.some(t => {
      const targetLetters = (t || '').replace(/[\s\-_]/g, '').toLowerCase().split('').sort().join('');
      return tileLetters === targetLetters;
    });
    if (!hasMatchingTargetCharSet) {
      return false;
    }
  }

  function search(): boolean {
    if (currentIds.length === n) {
      return evaluator.evaluate(act, currentIds).correct;
    }
    for (let i = 0; i < n; i++) {
      if (!used[i]) {
        used[i] = true;
        currentLabels.push(tiles[i].label);
        currentIds.push(tiles[i].id);

        const formed = currentLabels.join('');
        const sandhi = isTamil ? combineTamilSandhi(formed) : formed;
        const cleanF = formed.replace(/[\s\-_]/g, '').toLowerCase();
        const cleanS = sandhi.replace(/[\s\-_]/g, '').toLowerCase();

        const couldBePrefix = targetAns.some(t => {
          const cleanT = (t || '').replace(/[\s\-_]/g, '').toLowerCase();
          return cleanT.startsWith(cleanF) || cleanT.startsWith(cleanS);
        });

        if (couldBePrefix) {
          if (search()) return true;
        }

        currentIds.pop();
        currentLabels.pop();
        used[i] = false;
      }
    }
    return false;
  }

  return search();
}

/**
 * Derives the asset ID that the activity component would request.
 * Uses explicit fields (act.image or act.needsImage === true).
 * Never infers from prompt text.
 */
function getRequestedImageAssetId(act: Activity): string | null {
  if (act.needsImage === false) {
    return null;
  }

  const isEnglish = act.subject === 'English' || act.language?.startsWith('en');

  // Explicit image object
  if (act.image?.source) {
    return act.image.source;
  }

  // Explicit needsImage flag
  if (act.needsImage === true) {
    if (isEnglish) {
      const wordKey = act.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || act.id.toLowerCase();
      return `eng-${wordKey}`;
    }
    return `class3-tamil-picture-${act.id.toLowerCase()}`;
  }

  // For Tamil picture-recognition::select without explicit image field, check legacy ID
  if (!isEnglish && act.category === 'picture-recognition' && act.variant === 'select') {
    return `class3-tamil-picture-${act.id.toLowerCase()}`;
  }

  return null;
}

export async function validateQuestions(): Promise<{ summary: ValidationSummary; totalIssues: number }> {
  const repo = new LocalContentRepository();
  const activities = await repo.getActivities({ subject: 'all' });
  const resolver = new AssetResolver();

  const summary: ValidationSummary = {
    NO_BLANK_TEMPLATE: [],
    UNSOLVABLE: [],
    MULTIPLE_CORRECT: [],
    IMAGE_MISSING: [],
    STALE_TEMPLATE: [],
    EXTRA_TILES: [],
    DUPLICATE_IMAGE: [],
    DUPLICATE_ID: [],
    REAL_WORD_DISTRACTOR: [],
    IMAGE_LOST: [],
    PROMPT_MENTIONS_PICTURE: [],
    ANAGRAM_ALTERNATIVE: [],
    MISSING_ATTRIBUTION: [],
    BLOCKED_IMAGE: [],
    UNLICENSED_IMAGE: [],
  };

  const missingImagesPath = path.resolve('docs/missing-images.csv');
  const missingImagesSet = new Set<string>();
  if (fs.existsSync(missingImagesPath)) {
    const lines = fs.readFileSync(missingImagesPath, 'utf8').split('\n');
    for (const line of lines) {
      const id = line.split(',')[0]?.trim();
      if (id && id !== 'id') missingImagesSet.add(id);
    }
  }

  const UNCHANGED_TAMIL_NO_IMAGE = new Set([
    'FTS0661',
    'FTS0722',
    'FTS0666',
    'FTS0734',
    'FTS0768',
    'FTS0769',
    'FTS0906',
    'FTS0939',
  ]);

  // 1. DUPLICATE_ID
  const idSeen = new Map<string, number>();
  for (const act of activities) {
    idSeen.set(act.id, (idSeen.get(act.id) || 0) + 1);
  }
  for (const [id, count] of idSeen.entries()) {
    if (count > 1) {
      summary.DUPLICATE_ID.push(id);
    }
  }

  // 2. DUPLICATE_IMAGE preparation
  const imageHashToWords = new Map<string, { hash: string; diskPath: string; words: Set<string>; activities: string[] }>();

  // Process activities
  for (const act of activities) {
    const def = activityRegistry.getDefinition(act.category, act.variant);
    const evaluator = def?.evaluator;

    // Check REAL_WORD_DISTRACTOR: filling word-completion blank with wrong option forms real English word
    if (act.category === 'word-completion' && (act.subject === 'English' || act.language?.startsWith('en'))) {
      if (act.template && act.template.includes('_') && act.options && act.options.length > 0) {
        const cleanTemplate = act.template.replace(/\s+/g, '').toLowerCase();
        for (const opt of act.options) {
          const isCorrect = evaluator ? evaluator.evaluate(act, opt.id).correct : false;
          if (!isCorrect) {
            const cand = cleanTemplate.replace('_', opt.label.trim().toLowerCase());
            if (englishWordsSet.has(cand)) {
              summary.REAL_WORD_DISTRACTOR.push(act.id);
              break;
            }
          }
        }
      }
    }

    // Check NO_BLANK_TEMPLATE: word-completion questions whose template has no "_"
    if (act.category === 'word-completion') {
      if (!act.template || !act.template.includes('_')) {
        summary.NO_BLANK_TEMPLATE.push(act.id);
      }
    }

    // Check STALE_TEMPLATE: template contains "Selectable options", "Jumbled letter tiles", or " |", or word-entry with buttons has a template
    if (act.template && (
      act.template.includes('Selectable options') ||
      act.template.includes('Jumbled letter tiles') ||
      act.template.includes(' |') ||
      (act.variant === 'word-entry' && act.options && act.options.length > 0)
    )) {
      summary.STALE_TEMPLATE.push(act.id);
    }

    // Check EXTRA_TILES: arrange tiles contain more letters than the answer
    if (act.category === 'arrange-word') {
      const tiles = (act.options && act.options.length > 0)
        ? act.options.map(o => o.label)
        : (act.units || []);
      const tileLetters = tiles.join('').replace(/\s+/g, '').length;
      const primaryAns = Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : (act.correctAnswer || '');
      const ansLetters = primaryAns.replace(/\s+/g, '').length;
      if (tileLetters > ansLetters) {
        summary.EXTRA_TILES.push(act.id);
      }
    }

    // Check UNSOLVABLE and MULTIPLE_CORRECT using real evaluator
    if (!evaluator) {
      summary.UNSOLVABLE.push(act.id);
    } else if (act.category === 'arrange-word') {
      const options = (act.options && act.options.length > 0)
        ? act.options
        : (act.units?.map((u, i) => ({ id: String.fromCharCode(65 + i), label: u })) || []);
      
      const solvable = isArrangeSolvable(options, evaluator, act);
      if (!solvable) {
        summary.UNSOLVABLE.push(act.id);
      }
    } else if (act.options && act.options.length > 0) {
      let correctCount = 0;
      for (const opt of act.options) {
        if (evaluator.evaluate(act, opt.id).correct) {
          correctCount++;
        }
      }
      if (correctCount === 0) {
        summary.UNSOLVABLE.push(act.id);
      } else if (correctCount > 1) {
        summary.MULTIPLE_CORRECT.push(act.id);
      }
    } else {
      // Direct entry
      const targetAns = Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : (act.correctAnswer || act.targetWord || '');
      if (!evaluator.evaluate(act, targetAns).correct) {
        summary.UNSOLVABLE.push(act.id);
      }
    }

    // Check IMAGE_MISSING
    const requestedAssetId = getRequestedImageAssetId(act);
    let rendersImage = false;
    if (requestedAssetId) {
      const res = resolver.resolve({ id: requestedAssetId, type: 'image' });
      if (res.status !== 'resolved') {
        summary.IMAGE_MISSING.push(act.id);
      } else if (res.asset?.path) {
        rendersImage = true;
        // Track for DUPLICATE_IMAGE
        const fullDiskPath = path.resolve('public', res.asset.path.replace(/^\//, ''));
        if (fs.existsSync(fullDiskPath)) {
          const buf = fs.readFileSync(fullDiskPath);
          const hash = crypto.createHash('sha256').update(buf).digest('hex');
          const ansWord = (Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : (act.correctAnswer || act.targetWord || '')).trim().toLowerCase();
          
          if (!imageHashToWords.has(hash)) {
            imageHashToWords.set(hash, { hash, diskPath: fullDiskPath, words: new Set(), activities: [] });
          }
          const entry = imageHashToWords.get(hash)!;
          entry.words.add(ansWord);
          entry.activities.push(act.id);
        }

        // Check MISSING_ATTRIBUTION: any image in use whose license requires attribution but has no creator or license recorded
        const meta = (act.metadata as any)?.imageMeta;
        const asset = res.asset;
        const license = meta?.license || asset?.license || '';
        const creator = meta?.creator || asset?.creator || '';

        const licLower = (license || '').toLowerCase();
        const requiresAttribution = licLower.startsWith('cc-by') || licLower.startsWith('cc by') || /cc[- ]?by/i.test(licLower);

        if (requiresAttribution) {
          if (!creator.trim() || !license.trim()) {
            summary.MISSING_ATTRIBUTION.push(act.id);
          }
        }

        // Check UNLICENSED_IMAGE: every image in use with source "unknown"
        if (asset?.provenance?.source === 'unknown') {
          if (!summary.UNLICENSED_IMAGE.includes(asset.id)) {
            summary.UNLICENSED_IMAGE.push(asset.id);
          }
        }
      }
    }

    // Check IMAGE_LOST: an activity that should have rendered an image, but doesn't, excluding missing-images.csv
    const isImageIntended = act.needsImage === true ||
      Boolean(act.image?.source) ||
      Boolean(act.source?.originalActivity && act.source.originalActivity.includes('Picture')) ||
      (act.prompt && act.prompt.includes('படத்தில்'));

    if (isImageIntended && !rendersImage) {
      if (!missingImagesSet.has(act.id) && !UNCHANGED_TAMIL_NO_IMAGE.has(act.id)) {
        if (act.subject === 'Tamil') {
          const picKey = `class3-tamil-picture-${act.id.toLowerCase()}`;
          if (resolver.resolve({ id: picKey, type: 'image' }).status === 'resolved') {
            summary.IMAGE_LOST.push(act.id);
          }
        } else {
          summary.IMAGE_LOST.push(act.id);
        }
      }
    }

    // Check PROMPT_MENTIONS_PICTURE: the prompt contains "picture" or படத்தில் (or "this/these" with no other clue), but no image will render
    if (!rendersImage) {
      if (!UNCHANGED_TAMIL_NO_IMAGE.has(act.id)) {
        const p = act.prompt || '';
        if (p.includes('படத்தில்')) {
          summary.PROMPT_MENTIONS_PICTURE.push(act.id);
        } else if (/(?:^|[.!?]\s*)look at the picture/i.test(p) || /\bin the picture\b/i.test(p)) {
          summary.PROMPT_MENTIONS_PICTURE.push(act.id);
        } else if (
          /(?:this|these)\s+(?:food grain|body parts|object|picture)\b/i.test(p) ||
          /^choose the correct word and write it\.?$/i.test(p.trim())
        ) {
          summary.PROMPT_MENTIONS_PICTURE.push(act.id);
        }
      }
    }

    // Check ANAGRAM_ALTERNATIVE: for every English arrange-word question with single-letter tiles,
    // check if any other permutation forms a real English word (3+ letters in 20k common words).
    // If no image renders, it MUST have a distinguishing meaning clue in the prompt so kids aren't rejected for valid words.
    if (act.category === 'arrange-word' && (act.subject === 'English' || act.language?.startsWith('en'))) {
      const tiles = (act.options && act.options.length > 0)
        ? act.options.map(o => o.label.toLowerCase())
        : (act.units ? act.units.map(u => u.toLowerCase()) : []);
      if (tiles.length >= 3 && tiles.every(t => t.length === 1)) {
        const sorted = tiles.slice().sort().join('');
        const candidates = commonAnagramMap.get(sorted) || [];
        const targetClean = (Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : (act.correctAnswer || act.targetWord || '')).toLowerCase().replace(/\s+/g, '');
        const alternatives = candidates.filter(w => w !== targetClean);
        if (alternatives.length > 0) {
          if (!rendersImage) {
            if (!hasMeaningClue(act.prompt || '')) {
              summary.ANAGRAM_ALTERNATIVE.push(act.id);
            }
          }
        }
      }
    }
  }

function isIgnoredDuplicateGroup(words: Set<string>, activities: string[]): boolean {
  const wordArr = Array.from(words).sort();
  // Plausible English pairs (e.g. singular / plural)
  if (wordArr.length === 2) {
    if (wordArr[0] === 'finger' && wordArr[1] === 'fingers') return true;
    if (wordArr[0] === 'pond' && wordArr[1] === 'ponds') return true;
    // Q014 / Q126 colours (வண்ணங்கள் / நிறங்கள்)
    if (activities.includes('Q014') && activities.includes('Q126')) return true;
    if (wordArr.includes('வண்ணங்கள்') && wordArr.includes('நிறங்கள்')) return true;
  }
  // Tamil synonymous / legitimate shared pairs in Tamil vocabulary
  const tamilAllowedPairs = [
    ['அங்காடி', 'கடை'],
    ['உடம்பு', 'உடல்'],
    ['உருண்டை', 'பந்து'],
    ['சன்னல்', 'ஜன்னல்'],
    ['மீன்', 'மீன்கள்'],
    ['பரிசு', 'வாரஇதழ்'],
    ['grape', 'கொத்து'],
  ];
  for (const pair of tamilAllowedPairs) {
    if (wordArr.length === 2 && wordArr.includes(pair[0]) && wordArr.includes(pair[1])) {
      return true;
    }
  }
  return false;
}

  // Check DUPLICATE_IMAGE: two different answer words resolve to byte-identical image files
  for (const entry of imageHashToWords.values()) {
    if (entry.words.size > 1) {
      if (isIgnoredDuplicateGroup(entry.words, entry.activities)) {
        continue;
      }
      for (const actId of entry.activities) {
        if (!summary.DUPLICATE_IMAGE.includes(actId)) {
          summary.DUPLICATE_IMAGE.push(actId);
        }
      }
    }
  }

  // Check BLOCKED_IMAGE: any filename listed in docs/image-visual-audit.csv is referenced by the manifest
  const auditCsvPath = path.resolve('docs/image-visual-audit.csv');
  const blockedImageFiles = new Set<string>();
  if (fs.existsSync(auditCsvPath)) {
    const auditLines = fs.readFileSync(auditCsvPath, 'utf8').trim().split('\n').slice(1);
    for (const line of auditLines) {
      const match = line.match(/^"([^"]+)"/) || line.match(/^([^,]+)/);
      if (match) {
        blockedImageFiles.add(path.basename(match[1].trim()).toLowerCase());
      }
    }
  }

  const manifest = getDefaultManifest();
  for (const [assetId, asset] of Object.entries(manifest)) {
    const fn = path.basename(asset.path || '').toLowerCase();
    if (blockedImageFiles.has(fn)) {
      summary.BLOCKED_IMAGE.push(`${assetId} (${fn})`);
    }
  }

  const totalIssues = Object.entries(summary)
    .filter(([category]) => category !== 'UNLICENSED_IMAGE')
    .reduce((acc, [, list]) => acc + list.length, 0);
  return { summary, totalIssues };
}

async function main() {
  console.log('====================================================');
  console.log('          QUESTION DATA VALIDATION SUITE            ');
  console.log('====================================================\n');

  const { summary, totalIssues } = await validateQuestions();

  const categories: (keyof ValidationSummary)[] = [
    'NO_BLANK_TEMPLATE',
    'UNSOLVABLE',
    'MULTIPLE_CORRECT',
    'IMAGE_MISSING',
    'STALE_TEMPLATE',
    'EXTRA_TILES',
    'DUPLICATE_IMAGE',
    'DUPLICATE_ID',
    'REAL_WORD_DISTRACTOR',
    'IMAGE_LOST',
    'PROMPT_MENTIONS_PICTURE',
    'ANAGRAM_ALTERNATIVE',
    'MISSING_ATTRIBUTION',
    'BLOCKED_IMAGE',
    'UNLICENSED_IMAGE'
  ];

  console.log('--- VALIDATION SUMMARY BY CATEGORY ---');
  for (const cat of categories) {
    const ids = summary[cat];
    const label = cat === 'UNLICENSED_IMAGE' ? 'in-use images (non-failing advisory)' : 'issues';
    console.log(`[${cat}]: ${ids.length} ${label}`);
    if (ids.length > 0) {
      const preview = ids.length <= 15 ? ids.join(', ') : `${ids.slice(0, 15).join(', ')} ... (+${ids.length - 15} more)`;
      console.log(`  IDs: ${preview}`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`Total Validation Failures: ${totalIssues}`);
  console.log('----------------------------------------------------\n');

  if (totalIssues > 0) {
    console.error(`Validation failed with ${totalIssues} issue(s). Exiting with code 1.`);
    process.exit(1);
  } else {
    console.log('All validation checks passed cleanly!');
    process.exit(0);
  }
}

if (process.argv[1]?.endsWith('validate-questions.ts')) {
  main().catch(err => {
    console.error('Fatal error during validation:', err);
    process.exit(1);
  });
}
