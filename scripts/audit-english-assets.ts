import * as fs from 'fs';
import * as path from 'path';
import { Activity } from '../src/types';

interface CatalogedAsset {
  activityId: string;
  ewId: string;
  targetWord: string;
  activityCode: string;
  assetId: string;
  required: boolean;
  status: string;
  prompt: string;
}

interface TamilAssetEntry {
  type: string;
  source: string;
  path: string;
  alt: string;
}

const ENG_DIR = path.resolve('src/content/class-3/english');
const TAMIL_ASSETS_FILE = path.resolve('src/content/class-3/tamil/term-1/assets.json');
const ENG_ASSETS_FILE = path.join(ENG_DIR, 'assets.json');

const catalogedAssets: CatalogedAsset[] = JSON.parse(fs.readFileSync(ENG_ASSETS_FILE, 'utf8'));
const tamilAssets: Record<string, TamilAssetEntry> = JSON.parse(fs.readFileSync(TAMIL_ASSETS_FILE, 'utf8'));

// Load all 1238 activities
const allActivities: Activity[] = [];
for (let m = 1; m <= 8; m++) {
  const file = path.join(ENG_DIR, `module-${m}`, 'activities.json');
  if (fs.existsSync(file)) {
    const list: Activity[] = JSON.parse(fs.readFileSync(file, 'utf8'));
    allActivities.push(...list);
  }
}

console.log(`Loaded ${allActivities.length} total English activities.`);
console.log(`Loaded ${catalogedAssets.length} cataloged English asset entries.`);

// 1. Group cataloged assets by activity code
const byCode: Record<string, CatalogedAsset[]> = {};
for (const a of catalogedAssets) {
  if (!byCode[a.activityCode]) byCode[a.activityCode] = [];
  byCode[a.activityCode].push(a);
}

console.log('\n--- Cataloged Requirements by Activity Code ---');
for (const code of Object.keys(byCode).sort()) {
  console.log(`${code}: ${byCode[code].length}`);
}

// 2. Check all 1238 activities to see if any non-cataloged activity has "picture" or "image"
const uncatalogedWithPicture: Activity[] = [];
for (const act of allActivities) {
  const isCataloged = catalogedAssets.some(c => c.activityId === act.id);
  if (!isCataloged) {
    const text = `${act.prompt} ${act.clue || ''} ${act.template || ''} ${act.source?.originalActivity || ''}`.toLowerCase();
    if (text.includes('picture') || text.includes('image')) {
      uncatalogedWithPicture.push(act);
    }
  }
}
console.log(`\nUncataloged activities mentioning picture/image: ${uncatalogedWithPicture.length}`);

// 3. Inspect the 9 known anomalies
const anomalyIds = ['EW114', 'EW249', 'EW262', 'EW265', 'EW574', 'EW576', 'EW894', 'EW913', 'EW943'];
console.log('\n--- Inspection of 9 Known Anomalies ---');
for (const anomId of anomalyIds) {
  const act = allActivities.find(a => a.source?.ewId === anomId && a.role === 'new');
  if (act) {
    const cat = catalogedAssets.find(c => c.activityId === act.id);
    console.log(`- ${anomId} (${act.id}, Mod ${act.module}, Day ${act.day}, ${act.source?.activityCode}):`);
    console.log(`    Note: ${act.source?.anomalyNote}`);
    console.log(`    Cataloged as asset?: ${cat ? 'YES (' + cat.activityCode + ')' : 'NO'}`);
    console.log(`    Prompt: "${act.prompt}"`);
  }
}

export interface AuditItem {
  activityId: string;
  ewId: string;
  targetWord: string;
  module: number;
  day: number;
  activityCode: string;
  prompt: string;
  optionsOrUnits?: string[];
  template?: string;
  clue?: string;
  classification: 'REQUIRED' | 'TEXT_ONLY' | 'OPTIONAL' | 'NEEDS_REVIEW';
  status: 'MAPPED' | 'MISSING' | 'TEXT_ONLY';
  semanticKey: string;
  proposedPath?: string;
  reusedFromTamilAssetId?: string;
  reason: string;
}

const auditItems: AuditItem[] = [];

// Check all 22 Tamil assets against English required words
const candidateWords = ['sea', 'monkey', 'stone', 'rock', 'coin', 'plant', 'grandfather', 'street', 'road', 'moon', 'king', 'field', 'paddy', 'path', 'animal', 'house', 'home'];
for (const cand of candidateWords) {
  const matches = catalogedAssets.filter(c => c.targetWord.toLowerCase() === cand);
  if (matches.length > 0) {
    console.log(`[Tamil Candidate Check] Potential match found: "${cand}" in activities:`, matches.map(m => m.activityId));
  }
}

const EXACT_TAMIL_MATCHES: Record<string, { tamilAssetId: string; semanticReason: string }> = {
  'fruit': { tamilAssetId: 'class3-tamil-picture-q003', semanticReason: 'Exact match: பழம் (Fruit) depiction of fresh fruit' },
  'bag': { tamilAssetId: 'class3-tamil-picture-q104', semanticReason: 'Exact match: பை (Bag) depiction of school/tote bag' },
  'box': { tamilAssetId: 'class3-tamil-picture-q101', semanticReason: 'Exact match: பெட்டி (Box) depiction of standard storage box' },
  'dog': { tamilAssetId: 'class3-tamil-picture-q005', semanticReason: 'Exact match: நாய் (Dog) depiction of domestic dog' },
  'rabbit': { tamilAssetId: 'class3-tamil-picture-q001', semanticReason: 'Exact match: முயல் (Rabbit) depiction of rabbit' },
  'rat': { tamilAssetId: 'class3-tamil-picture-q013', semanticReason: 'Exact match: எலி (Rat) depiction of rat/mouse' },
  'shop': { tamilAssetId: 'class3-tamil-picture-q034', semanticReason: 'Exact match: கடை (Shop) depiction of small store/shop' },
  'colour': { tamilAssetId: 'class3-tamil-picture-q014', semanticReason: 'Exact match: வண்ணங்கள் (Colours) depiction of multi-colour palette' }
};

for (const cat of catalogedAssets) {
  const act = allActivities.find(a => a.id === cat.activityId);
  const prompt = cat.prompt || act?.prompt || '';
  const word = cat.targetWord.toLowerCase();
  const code = cat.activityCode;
  const modNum = act?.module ?? 0;
  const dayNum = act?.day ?? 0;

  let classification: 'REQUIRED' | 'TEXT_ONLY' | 'OPTIONAL' | 'NEEDS_REVIEW' = 'REQUIRED';
  let reason = '';

  if (code === 'E01') {
    // Picture -> Write Word
    classification = 'REQUIRED';
    reason = 'Picture -> Write word requires image stimulus to identify target vocabulary';
  } else if (code === 'E12') {
    // Picture -> Write / Select variant
    classification = 'REQUIRED';
    reason = 'E12 picture variant requires image stimulus';
  } else if (code === 'E08') {
    // Spelling Choice: some say "Look at the picture. Choose the correct spelling:", but some say "Yesterday, Ravi ______ a picture of a tree..."
    if (prompt.toLowerCase().includes('look at the picture')) {
      classification = 'REQUIRED';
      reason = 'Spelling choice explicitly prompts learner to look at the picture to disambiguate target';
    } else {
      classification = 'TEXT_ONLY';
      reason = 'Prompt contains the noun "picture" within the sentence, no image stimulus required';
    }
  } else if (code === 'E04') {
    // Arrange Syllables: "The two pictures are not the same...", "The ability to form pictures..."
    classification = 'TEXT_ONLY';
    reason = 'Sentence clue mentions the noun "picture", syllable arrangement is purely text-based';
  } else if (code === 'E06') {
    // Arrange Letters: cloudy vs pointing
    if (prompt.toLowerCase().includes('look at the picture')) {
      classification = 'REQUIRED';
      reason = 'Letter arrangement explicitly asks to look at picture';
    } else {
      classification = 'TEXT_ONLY';
      reason = 'Sentence clue mentions the noun "picture", letter arrangement is text-based';
    }
  } else if (code === 'E07') {
    // Arrange Compound Parts: eyelash, grasshopper, dragonfly
    if (prompt.toLowerCase().includes('look at the picture')) {
      classification = 'REQUIRED';
      reason = 'Compound part arrangement with picture stimulus';
    } else {
      classification = 'TEXT_ONLY';
      reason = 'Text-based compound part arrangement';
    }
  } else if (code === 'E05') {
    // Missing Letters: e.g. "Use a ______ to hang the picture on the wall."
    if (prompt.toLowerCase().includes('look at the picture')) {
      classification = 'REQUIRED';
      reason = 'Missing letter activity explicitly prompts learner with picture';
    } else {
      classification = 'TEXT_ONLY';
      reason = 'Prompt sentence contains the word "picture" as an object, activity is text-based';
    }
  } else if (code === 'E09' || code === 'E11') {
    if (prompt.toLowerCase().includes('look at the picture')) {
      classification = 'REQUIRED';
      reason = 'Explicit picture prompt';
    } else {
      classification = 'TEXT_ONLY';
      reason = 'Self-contained text prompt';
    }
  }

  // Determine semantic key and mapping
  const semanticKey = `eng-${word.replace(/[^a-z0-9]/g, '-')}`;
  let status: 'MAPPED' | 'MISSING' | 'TEXT_ONLY' = 'MISSING';
  let proposedPath: string | undefined = undefined;
  let reusedFromTamilAssetId: string | undefined = undefined;

  if (classification === 'TEXT_ONLY') {
    status = 'TEXT_ONLY';
  } else {
    // Check if reusable from Tamil
    if (EXACT_TAMIL_MATCHES[word]) {
      const match = EXACT_TAMIL_MATCHES[word];
      const tAsset = tamilAssets[match.tamilAssetId];
      status = 'MAPPED';
      proposedPath = tAsset.path;
      reusedFromTamilAssetId = match.tamilAssetId;
    } else {
      status = 'MISSING';
      proposedPath = `/assets/class-3/english/images/${semanticKey}.jpg`;
    }
  }

  auditItems.push({
    activityId: cat.activityId,
    ewId: cat.ewId,
    targetWord: cat.targetWord,
    module: modNum,
    day: dayNum,
    activityCode: code,
    prompt,
    optionsOrUnits: act?.options?.map(o => o.label) || act?.units,
    template: act?.template,
    clue: act?.clue,
    classification,
    status,
    semanticKey,
    proposedPath,
    reusedFromTamilAssetId,
    reason
  });
}

// Stats
const summary = {
  totalCataloged: catalogedAssets.length,
  required: auditItems.filter(i => i.classification === 'REQUIRED').length,
  textOnly: auditItems.filter(i => i.classification === 'TEXT_ONLY').length,
  optional: auditItems.filter(i => i.classification === 'OPTIONAL').length,
  needsReview: auditItems.filter(i => i.classification === 'NEEDS_REVIEW').length,
  mappedToTamil: auditItems.filter(i => i.status === 'MAPPED').length,
  missing: auditItems.filter(i => i.status === 'MISSING').length,
  uniqueWordsRequired: new Set(auditItems.filter(i => i.classification === 'REQUIRED').map(i => i.targetWord.toLowerCase())).size,
  uniqueWordsMapped: new Set(auditItems.filter(i => i.status === 'MAPPED').map(i => i.targetWord.toLowerCase())).size,
  uniqueWordsMissing: new Set(auditItems.filter(i => i.status === 'MISSING').map(i => i.targetWord.toLowerCase())).size
};

console.log('\n========================================');
console.log('AUDIT SUMMARY:');
console.log(`Total Cataloged: ${summary.totalCataloged}`);
console.log(`REQUIRED: ${summary.required}`);
console.log(`TEXT_ONLY: ${summary.textOnly}`);
console.log(`MAPPED (Reused from Tamil): ${summary.mappedToTamil}`);
console.log(`MISSING: ${summary.missing}`);
console.log(`Unique Words in REQUIRED: ${summary.uniqueWordsRequired}`);
console.log(`Unique Words Mapped: ${summary.uniqueWordsMapped}`);
console.log(`Unique Words Missing: ${summary.uniqueWordsMissing}`);
console.log('========================================\n');

// Breakdown by activity code for REQUIRED vs TEXT_ONLY
const codeBreakdown: Record<string, { total: number; required: number; textOnly: number; mapped: number; missing: number }> = {};
for (const item of auditItems) {
  if (!codeBreakdown[item.activityCode]) {
    codeBreakdown[item.activityCode] = { total: 0, required: 0, textOnly: 0, mapped: 0, missing: 0 };
  }
  codeBreakdown[item.activityCode].total++;
  if (item.classification === 'REQUIRED') codeBreakdown[item.activityCode].required++;
  if (item.classification === 'TEXT_ONLY') codeBreakdown[item.activityCode].textOnly++;
  if (item.status === 'MAPPED') codeBreakdown[item.activityCode].mapped++;
  if (item.status === 'MISSING') codeBreakdown[item.activityCode].missing++;
}

console.log('--- Breakdown by Activity Code ---');
console.table(codeBreakdown);

// Write the full audit output as JSON for tooling & report generation
fs.writeFileSync('src/content/class-3/english/audit-results.json', JSON.stringify(auditItems, null, 2));
console.log('\nWrote src/content/class-3/english/audit-results.json successfully.');
