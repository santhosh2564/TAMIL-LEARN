import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { LocalContentRepository } from '../src/repositories/implementations/LocalContentRepository';
import { activityRegistry } from '../src/engine/ActivityRegistry';
import { registerCoreActivities } from '../src/features/Activity/registerActivities';
import { AssetResolver, getDefaultManifest } from '../src/engine/assets/AssetResolver';
import { combineTamilSandhi, getGraphemes } from '../src/utils/tamil';
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

export function tamilSubstrMatch(text: string, sub: string): boolean {
  if (!text || !sub) return false;
  let idx = 0;
  while ((idx = text.indexOf(sub, idx)) !== -1) {
    const nextChar = text[idx + sub.length];
    // In Tamil, if followed by combining vowel sign or virama, it's not a complete grapheme boundary
    if (nextChar && /[\u0BBE-\u0BCD\u0BD7]/.test(nextChar)) {
      idx += 1;
      continue;
    }
    return true;
  }
  return false;
}

export function cleanPromptForCheck(prompt: string): string {
  return prompt
    // remove fill-in blanks like [blank], ______, etc. and any preceding incomplete prefix like வி[blank] or வட்[blank]
    .replace(/[^\s—–]+\[blank\]/g, '')
    .replace(/\[blank\]/g, '')
    .replace(/_{2,}/g, '')
    .replace(/_[^\s]+/g, '')
    // remove standard trailing activity boilerplate
    .replace(/எழுத்து(?:களை| அலகுகளை)ச் சரியான வரிசையில் அமைத்துச் சொல்லை (?:உருவாக்கு|உருவாக்குக|அமைக்கவும்)\.?/g, '')
    .replace(/சரியான சொல்லைத் தேர்ந்தெ(?:டு|டுக்கவும்)\.?/g, '')
    .replace(/சரியான தமிழ்ச் சொல்லைத் தேர்ந்தெடுக்கவும்\.?/g, '')
    .replace(/சரியான எழுத்து வடிவத்தைத் தேர்ந்தெடு\.?/g, '')
    .replace(/படத்திற்கான சொல்லை உருவாக்கு\.?/g, '')
    .replace(/Look at the picture\.?/gi, '')
    .replace(/Complete the word:?/gi, '')
    .replace(/Choose the correct (?:word|spelling)\.?:?/gi, '')
    .trim();
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
  ANSWER_IN_PROMPT: string[];
  PROVENANCE_UNVERIFIED: string[];
  SYNONYM_DISTRACTOR: string[];
  DUPLICATE_OPTIONS: string[];
  INSTRUCTION_MISMATCH: string[];
  TOO_FEW_TILES: string[];
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
    ANSWER_IN_PROMPT: [],
    PROVENANCE_UNVERIFIED: [],
    SYNONYM_DISTRACTOR: [],
    DUPLICATE_OPTIONS: [],
    INSTRUCTION_MISMATCH: [],
    TOO_FEW_TILES: [],
  };

  const ALLOWED_TWO_TILE_WORDS = new Set([
    'Q007',
    'FTS0076',
    'FTS0553',
    'FTS0554',
    'FTS0644',
    'FTS0645',
    'FTS0656',
    'FTS0810',
    'FTS0908'
  ]);

  // Load Tamil synonyms map for SYNONYM_DISTRACTOR check
  const tamilSynonymsPath = path.resolve('docs/tamil-synonyms.csv');
  const tamilSynonymsMap = new Map<string, Set<string>>();
  if (fs.existsSync(tamilSynonymsPath)) {
    const lines = fs.readFileSync(tamilSynonymsPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Parse CSV line (e.g. "word","syn1; syn2","notes")
      const match = trimmed.match(/^"([^"]+)"(?:\s*,\s*"([^"]*)")?/);
      if (match) {
        const word = match[1].trim();
        const synList = match[2] ? match[2].split(/[;,|]/).map(s => s.trim()).filter(Boolean) : [];
        if (!tamilSynonymsMap.has(word)) tamilSynonymsMap.set(word, new Set());
        for (const s of synList) {
          tamilSynonymsMap.get(word)!.add(s);
          if (!tamilSynonymsMap.has(s)) tamilSynonymsMap.set(s, new Set());
          tamilSynonymsMap.get(s)!.add(word);
        }
      }
    }
  }

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

    // Check ANSWER_IN_PROMPT: correctAnswer (or for Tamil, its stem with last 1-2 graphemes removed, or 3+ consecutive tiles joined) appears in prompt
    const rawPrompt = act.prompt?.trim();
    if (rawPrompt) {
      const isTamil = act.subject === 'Tamil' || (act.language && act.language.startsWith('ta'));
      const prompt = cleanPromptForCheck(rawPrompt);
      if (prompt) {
        let targetAns = (act.category === 'word-completion' ? (act.targetWord || act.correctAnswer) : (act.correctAnswer || act.targetWord));
        if (Array.isArray(targetAns)) targetAns = targetAns[0];
        const ans = (targetAns || '').trim();

        if (ans) {
          let hasAnswerInPrompt = false;

          if (isTamil) {
            // 1. Direct answer in prompt
            if (tamilSubstrMatch(prompt, ans)) {
              hasAnswerInPrompt = true;
            } else {
              const graphemes = getGraphemes(ans);

              // 2. Stem with last 1-2 graphemes removed (stem must have >= 3 graphemes)
              if (graphemes.length >= 4) {
                const stem1 = graphemes.slice(0, -1).join('');
                if (getGraphemes(stem1).length >= 3 && tamilSubstrMatch(prompt, stem1)) {
                  hasAnswerInPrompt = true;
                } else if (graphemes.length >= 5) {
                  const stem2 = graphemes.slice(0, -2).join('');
                  if (getGraphemes(stem2).length >= 3 && tamilSubstrMatch(prompt, stem2)) {
                    hasAnswerInPrompt = true;
                  }
                }
              }

              // Special check for noun plural marker -ர்கள் / -கள் (e.g. மாணவர்கள் -> மாணவ)
              if (!hasAnswerInPrompt && ans.endsWith('ர்கள்') && graphemes.length >= 4) {
                const stemPlural = ans.slice(0, -'ர்கள்'.length);
                if (getGraphemes(stemPlural).length >= 3 && tamilSubstrMatch(prompt, stemPlural)) {
                  hasAnswerInPrompt = true;
                }
              }
              if (!hasAnswerInPrompt && ans.endsWith('கள்') && graphemes.length >= 4) {
                const stemPlural = ans.slice(0, -'கள்'.length);
                if (getGraphemes(stemPlural).length >= 3 && tamilSubstrMatch(prompt, stemPlural)) {
                  hasAnswerInPrompt = true;
                }
              }

              // 3. 3+ consecutive tiles joined (for arrange-word questions)
              if (!hasAnswerInPrompt && act.category === 'arrange-word') {
                const tiles = act.units || (act.options ? act.options.map((o: any) => o.label) : []);
                if (tiles.length >= 3) {
                  for (let i = 0; i <= tiles.length - 3; i++) {
                    const joined = tiles.slice(i, i + 3).join('');
                    if (getGraphemes(joined).length >= 3 && tamilSubstrMatch(prompt, joined)) {
                      hasAnswerInPrompt = true;
                      break;
                    }
                  }
                }
              }
            }
          } else {
            // English: whole-word case-insensitive match
            const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (regex.test(prompt)) {
              hasAnswerInPrompt = true;
            }
          }

          if (hasAnswerInPrompt) {
            summary.ANSWER_IN_PROMPT.push(act.id);
          }
        }
      }
    }

    // Check SYNONYM_DISTRACTOR: for Tamil meaning-match and context-choice questions, flag any question where a distractor is listed as a synonym of the answer
    if (act.subject === 'Tamil' && (act.category === 'meaning-match' || act.category === 'context-choice')) {
      const ans = String(act.correctAnswer || act.targetWord || '').trim();
      const synonyms = tamilSynonymsMap.get(ans);
      if (synonyms && synonyms.size > 0 && Array.isArray(act.options)) {
        for (const opt of act.options) {
          const optLabel = String((opt as any).label || (opt as any).text || opt).trim();
          if (optLabel && optLabel !== ans && synonyms.has(optLabel)) {
            summary.SYNONYM_DISTRACTOR.push(act.id);
            console.warn(`[SYNONYM_DISTRACTOR] ${act.id} (${act.category}): Target answer '${ans}' has synonym distractor '${optLabel}'`);
            break;
          }
        }
      }
    }

    // Check DUPLICATE_OPTIONS: two options with the same label after trimming, outside arrange-word
    if (act.category !== 'arrange-word' && Array.isArray(act.options) && act.options.length > 1) {
      const seenLabels = new Set<string>();
      for (const opt of act.options) {
        const label = String((opt as any).label || (opt as any).text || opt).trim();
        if (seenLabels.has(label)) {
          summary.DUPLICATE_OPTIONS.push(act.id);
          console.warn(`[DUPLICATE_OPTIONS] ${act.id}: Duplicate option label '${label}'`);
          break;
        }
        seenLabels.add(label);
      }
    }

    // Check INSTRUCTION_MISMATCH: Tamil prompts saying உருவாக்கு / அமைக்கவும் / அமைத்து on non-arrange, and தேர்ந்தெடு on arrange
    if (act.subject === 'Tamil') {
      const p = act.prompt || '';
      if (act.category !== 'arrange-word') {
        if (/உருவாக்கு|அமைக்கவும்|அமைத்து/.test(p)) {
          summary.INSTRUCTION_MISMATCH.push(act.id);
          console.warn(`[INSTRUCTION_MISMATCH] ${act.id} (${act.category}): Non-arrange prompt contains arrange keyword: '${p}'`);
        }
      } else {
        if (/தேர்ந்தெடு/.test(p)) {
          summary.INSTRUCTION_MISMATCH.push(act.id);
          console.warn(`[INSTRUCTION_MISMATCH] ${act.id} (${act.category}): Arrange prompt contains select keyword: '${p}'`);
        }
      }
    }

    // Check TOO_FEW_TILES: Tamil arrange questions with fewer than 3 tiles (failing check, except allowed 2-grapheme words)
    if (act.subject === 'Tamil' && act.category === 'arrange-word') {
      const tileCount = act.options?.length || act.units?.length || 0;
      if (tileCount < 3 && !ALLOWED_TWO_TILE_WORDS.has(act.id)) {
        summary.TOO_FEW_TILES.push(act.id);
        console.warn(`[TOO_FEW_TILES] ${act.id}: Arrange question has fewer than 3 tiles (${tileCount} tiles)`);
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
    ['rabbit', 'முயல்'],
    ['dog', 'நாய்'],
    ['rat', 'எலி'],
    ['box', 'பெட்டி'],
    ['bag', 'பை'],
    ['shop', 'அங்காடி'],
    ['shop', 'கடை'],
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
  const blockedImagePaths = new Set<string>();
  const blockedEnglishFiles = new Set<string>();
  if (fs.existsSync(auditCsvPath)) {
    const auditLines = fs.readFileSync(auditCsvPath, 'utf8').trim().split('\n').slice(1);
    for (const line of auditLines) {
      const match = line.match(/^"([^"]+)"/) || line.match(/^([^,]+)/);
      if (match) {
        const fullRelPath = match[1].trim().replace(/\\/g, '/');
        const webPath = fullRelPath.replace(/^public/, '').toLowerCase();
        blockedImagePaths.add(webPath);
        if (webPath.includes('english')) {
          blockedEnglishFiles.add(path.basename(webPath).toLowerCase());
        }
      }
    }
  }

  const manifest = getDefaultManifest();
  for (const [assetId, asset] of Object.entries(manifest)) {
    const p = (asset.path || '').replace(/\\/g, '/').toLowerCase();
    const fn = path.basename(asset.path || '').toLowerCase();
    if (blockedImagePaths.has(p) || (p.includes('english') && blockedEnglishFiles.has(fn))) {
      summary.BLOCKED_IMAGE.push(`${assetId} (${fn})`);
    }
  }

  // Check PROVENANCE_UNVERIFIED:
  // Fail if an image's manifest provenance isn't backed by a hash match to a candidate whose metadata records that license and creator.
  // 17. PROVENANCE_UNVERIFIED check
  // Check against docs/license-evidence/*.json (from the real live source).
  // Fails if:
  // - Image file on disk missing or hash doesn't match provenance.sha256
  // - docs/license-evidence/<assetId>.json missing
  // - Live license has NC or ND, or is not in allowed list
  // - Manifest creator does not match liveCreator
  // - Manifest license does not match liveLicense
  const evidenceBaseDir = path.resolve('docs/license-evidence');
  const engManifestPath = path.resolve('src/content/class-3/english/asset-manifest.json');
  if (fs.existsSync(engManifestPath)) {
    const engManifest = JSON.parse(fs.readFileSync(engManifestPath, 'utf8'));
    for (const [assetId, asset] of Object.entries<any>(engManifest)) {
      const prov = asset?.provenance;
      if (prov && prov.source && prov.source !== 'unknown') {
        const imgPath = asset.path ? path.resolve('public', asset.path.replace(/^\//, '')) : '';
        if (!imgPath || !fs.existsSync(imgPath)) {
          summary.PROVENANCE_UNVERIFIED.push(`${assetId} (file missing on disk)`);
          continue;
        }

        const actualHash = crypto.createHash('sha256').update(fs.readFileSync(imgPath)).digest('hex');

        if (!prov.sha256 || prov.sha256.toLowerCase() !== actualHash.toLowerCase()) {
          summary.PROVENANCE_UNVERIFIED.push(`${assetId} (provenance.sha256 missing or does not match disk hash ${actualHash.slice(0, 8)})`);
          continue;
        }

        const evidencePath = path.join(evidenceBaseDir, `${assetId}.json`);
        if (!fs.existsSync(evidencePath)) {
          summary.PROVENANCE_UNVERIFIED.push(`${assetId} (missing live license evidence in docs/license-evidence/${assetId}.json)`);
          continue;
        }

        let evidence: any;
        try {
          evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
        } catch {
          summary.PROVENANCE_UNVERIFIED.push(`${assetId} (corrupt license evidence in docs/license-evidence/${assetId}.json)`);
          continue;
        }

        if (!evidence.isAllowedLicense || evidence.liveLicense?.includes('nc') || evidence.liveLicense?.includes('nd')) {
          summary.PROVENANCE_UNVERIFIED.push(`${assetId} (disallowed license ${evidence.liveLicense}: ${evidence.disallowedReason || 'NC/ND license'})`);
          continue;
        }

        const expectedCreator = (evidence.liveCreator || '').trim();
        const actualCreator = (prov.creator || asset.creator || '').trim();
        const expectedLicense = (evidence.liveLicense || '').trim().toLowerCase();
        const actualLicense = (prov.license || asset.license || '').trim().toLowerCase();

        if (expectedCreator !== actualCreator || expectedLicense !== actualLicense) {
          summary.PROVENANCE_UNVERIFIED.push(
            `${assetId} (provenance mismatch with live source: live evidence has creator="${expectedCreator}", license="${expectedLicense}"; manifest has creator="${actualCreator}", license="${actualLicense}")`
          );
        }
      }
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
    'UNLICENSED_IMAGE',
    'ANSWER_IN_PROMPT',
    'PROVENANCE_UNVERIFIED',
    'SYNONYM_DISTRACTOR',
    'DUPLICATE_OPTIONS',
    'INSTRUCTION_MISMATCH',
    'TOO_FEW_TILES'
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
