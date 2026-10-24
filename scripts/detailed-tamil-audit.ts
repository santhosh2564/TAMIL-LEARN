import * as fs from 'fs';
import * as path from 'path';

const BASE_DIR = path.resolve('tamil_json_by_module_activity');
const INDEX_PATH = path.join(BASE_DIR, 'index.json');

// Tamil Unicode regex range: \u0B80-\u0BFF
const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/;
const REPLACEMENT_CHAR_REGEX = /\uFFFD/;

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

function runAudit() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error('Missing index.json');
  const moduleDirs = fs.readdirSync(BASE_DIR).filter(f => fs.statSync(path.join(BASE_DIR, f)).isDirectory());

  let totalRecords = 0;
  let filesCount = 0;
  const records: (RawRecord & { _file: string })[] = [];
  const activityCounts: Record<string, number> = {};
  const moduleCounts: Record<string, number> = {};
  
  // Word extraction
  const allTargetWords: string[] = [];
  const allCorrectAnswers: string[] = [];
  const allWordsInDataset = new Set<string>();
  const allTamilTokensList: string[] = [];

  // Unicode checks
  const unicodeIssues: { file: string; id: string; field: string; issue: string; text: string }[] = [];

  // Picture questions
  const pictureRecords: (RawRecord & { _file: string })[] = [];
  const imagePaths: { file: string; id: string; path: string; existsInSara: boolean; existsInTamilLearn: boolean }[] = [];

  // Evaluator check prep
  const evaluatorMismatches: { file: string; id: string; activity: string; answer: string; reason: string }[] = [];

  for (const modDir of moduleDirs) {
    const files = fs.readdirSync(path.join(BASE_DIR, modDir)).filter(f => f.endsWith('.json'));
    for (const f of files) {
      filesCount++;
      const relPath = path.join(modDir, f);
      const fullPath = path.join(BASE_DIR, relPath);
      const fileData: RawRecord[] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

      for (const rec of fileData) {
        totalRecords++;
        records.push({ ...rec, _file: relPath });

        const mod = (rec['Module'] || modDir).trim();
        moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;

        const act = (rec['Activity'] || 'Unknown').trim();
        activityCounts[act] = (activityCounts[act] || 0) + 1;

        const id = rec['Question ID'] || rec['FTS ID'] || rec['Source ID'] || `rec_${totalRecords}`;

        // Tamil Unicode Checks
        const checkTextField = (field: string, val: unknown) => {
          if (typeof val !== 'string') return;
          if (REPLACEMENT_CHAR_REGEX.test(val)) {
            unicodeIssues.push({ file: relPath, id, field, issue: 'Replacement character U+FFFD () found', text: val });
          }
          if (val.includes('\u0000')) {
            unicodeIssues.push({ file: relPath, id, field, issue: 'Null byte found', text: val });
          }
          // Check for broken encoding sequences like Ã, Â, etc.
          if (/[\u00C0-\u00FF][\u0080-\u00BF]/.test(val)) {
            unicodeIssues.push({ file: relPath, id, field, issue: 'Possible mojibake/double UTF-8 sequence', text: val });
          }
        };

        checkTextField('Target Word', rec['Target Word']);
        checkTextField('Correct Answer', rec['Correct Answer']);
        checkTextField('Question / Instruction', rec['Question / Instruction']);
        checkTextField('Options / Units', rec['Options / Units']);
        checkTextField('Normalized Word', rec['Normalized Word']);
        checkTextField('Source Reference / Context', rec['Source Reference / Context']);

        // Word extraction
        if (rec['Target Word']) {
          const tw = rec['Target Word'].trim();
          allTargetWords.push(tw);
          allWordsInDataset.add(tw);
        }
        if (rec['Correct Answer']) {
          allCorrectAnswers.push(rec['Correct Answer'].trim());
        }

        // Tokenize Tamil words across all text fields
        const extractTamilWords = (text?: unknown) => {
          if (!text || typeof text !== 'string') return;
          // Split on whitespace, punctuation, pipes, etc.
          const tokens = text.split(/[\s|,.?!()[\]{}–—:;"'/\\<>]+/);
          for (const tok of tokens) {
            const clean = tok.trim();
            if (clean && TAMIL_CHAR_REGEX.test(clean)) {
              allTamilTokensList.push(clean);
              allWordsInDataset.add(clean);
            }
          }
        };

        extractTamilWords(rec['Target Word']);
        extractTamilWords(rec['Correct Answer']);
        extractTamilWords(rec['Normalized Word']);
        extractTamilWords(rec['Options / Units']);
        extractTamilWords(rec['Question / Instruction']);
        extractTamilWords(rec['Source Reference / Context']);

        // Picture questions
        const isPic = (rec['Picture Required'] || '').toLowerCase() === 'yes' ||
                      act.toLowerCase().includes('picture') ||
                      !!rec.image;
        if (isPic) {
          pictureRecords.push({ ...rec, _file: relPath });
          if (rec.image?.path) {
            const clean = rec.image.path.replace(/^\//, '');
            const saraPath = path.resolve('public', clean);
            const tlPath = path.resolve('c:/Users/santh/Desktop/tamil-learn/public', clean);
            imagePaths.push({
              file: relPath,
              id,
              path: rec.image.path,
              existsInSara: fs.existsSync(saraPath),
              existsInTamilLearn: fs.existsSync(tlPath)
            });
          }
        }

        // Evaluator compatibility check
        // Check if correct answer matches options/units
        const rawOptions = rec['Options / Units'];
        const answer = rec['Correct Answer']?.trim();

        if (act === 'Arrange Tamil Units' || act === 'Picture → Arrange' || act.includes('Arrange')) {
          // Units must be reconstructible or non-empty
          if (!rawOptions || !rawOptions.includes('|')) {
            evaluatorMismatches.push({
              file: relPath,
              id,
              activity: act,
              answer: answer || '',
              reason: `Options/Units does not contain pipe separator: "${rawOptions}"`
            });
          }
        } else if (act.includes('Select') || act.includes('Spelling')) {
          if (rawOptions && rawOptions.includes('|')) {
            const opts = rawOptions.split('|').map(o => o.trim()).filter(Boolean);
            if (!opts.includes(answer || '')) {
              evaluatorMismatches.push({
                file: relPath,
                id,
                activity: act,
                answer: answer || '',
                reason: `Correct answer "${answer}" not in options [${opts.join(', ')}]`
              });
            }
          }
        }
      }
    }
  }

  const summary = {
    totalModules: moduleDirs.length,
    totalJsonFilesExcludingIndex: filesCount,
    totalJsonFilesIncludingIndex: filesCount + 1,
    totalQuestions: totalRecords,
    totalTargetWords: allTargetWords.length,
    uniqueTargetWords: new Set(allTargetWords).size,
    totalTamilTokenOccurrences: allTamilTokensList.length,
    uniqueTamilTokensInDataset: allWordsInDataset.size,
    distinctActivityTypesCount: Object.keys(activityCounts).length,
    activityCounts,
    moduleCounts,
    pictureQuestionsCount: pictureRecords.length,
    recordsWithImagePath: imagePaths.length,
    imagesInSara: imagePaths.filter(p => p.existsInSara).length,
    imagesInTamilLearn: imagePaths.filter(p => p.existsInTamilLearn).length,
    unicodeIssuesCount: unicodeIssues.length,
    unicodeIssues,
    evaluatorMismatchesCount: evaluatorMismatches.length,
    evaluatorMismatches,
  };

  fs.writeFileSync('tamil-audit-report.json', JSON.stringify(summary, null, 2), 'utf8');

  console.log('--- DETAILED TAMIL AUDIT SUMMARY ---');
  console.log('Total Modules:', summary.totalModules);
  console.log('Total JSON files (excluding index.json):', summary.totalJsonFilesExcludingIndex);
  console.log('Total JSON files (including index.json):', summary.totalJsonFilesIncludingIndex);
  console.log('Total Questions / Activities:', summary.totalQuestions);
  console.log('Total Target Words:', summary.totalTargetWords);
  console.log('Unique Target Words:', summary.uniqueTargetWords);
  console.log('Total Tamil Token Occurrences:', summary.totalTamilTokenOccurrences);
  console.log('Unique Tamil Words/Tokens in Dataset:', summary.uniqueTamilTokensInDataset);
  console.log('Distinct Activity Types:', summary.distinctActivityTypesCount);
  console.log('Total Picture Questions:', summary.pictureQuestionsCount);
  console.log('Total Records with Image Path:', summary.recordsWithImagePath);
  console.log(`Images found in sara/public: ${summary.imagesInSara} / ${summary.recordsWithImagePath}`);
  console.log(`Images found in tamil-learn/public: ${summary.imagesInTamilLearn} / ${summary.recordsWithImagePath}`);
  console.log('Unicode Issues found:', summary.unicodeIssuesCount);
  console.log('Evaluator Mismatches / Warnings:', summary.evaluatorMismatchesCount);
}

runAudit();
