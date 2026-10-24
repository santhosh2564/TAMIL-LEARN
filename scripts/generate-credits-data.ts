import * as fs from 'fs';
import * as path from 'path';

export interface ImageCredit {
  id: string;
  word: string;
  path: string;
  creator: string;
  license: string;
  licenseName: string;
  licenseUrl: string;
  sourcePageUrl: string;
}

export function formatLicenseName(license?: string): string {
  if (!license) return '';
  const trimmed = license.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('cc-by') || lower.startsWith('cc by') || lower.includes('cc-by') || lower.includes('cc by')) {
    if (lower.includes('cc-by-sa-4.0') || lower.includes('cc by-sa 4.0')) return 'CC BY-SA 4.0';
    if (lower.includes('cc-by-sa-3.0-es') || lower.includes('cc by-sa 3.0 es')) return 'CC BY-SA 3.0 ES';
    if (lower.includes('cc-by-sa-3.0') || lower.includes('cc by-sa 3.0')) return 'CC BY-SA 3.0';
    if (lower.includes('cc-by-sa-2.5') || lower.includes('cc by-sa 2.5')) return 'CC BY-SA 2.5';
    if (lower.includes('cc-by-sa-2.0') || lower.includes('cc by-sa 2.0')) return 'CC BY-SA 2.0';
    if (lower.includes('cc-by-4.0') || lower.includes('cc by 4.0')) return 'CC BY 4.0';
    if (lower.includes('cc-by-3.0') || lower.includes('cc by 3.0')) return 'CC BY 3.0';
    if (lower.includes('cc-by-2.5') || lower.includes('cc by-2.5')) return 'CC BY 2.5';
    if (lower.includes('cc-by-2.0') || lower.includes('cc by 2.0')) return 'CC BY 2.0';
    return trimmed.toUpperCase().replace(/[-_]/g, ' ');
  }
  return trimmed;
}

export function getLicenseUrl(license?: string): string {
  const lower = (license || '').toLowerCase();
  if (lower.includes('cc-by-sa-3.0-es')) return 'https://creativecommons.org/licenses/by-sa/3.0/es/';
  if (lower.includes('cc-by-sa-4.0')) return 'https://creativecommons.org/licenses/by-sa/4.0/';
  if (lower.includes('cc-by-sa-3.0')) return 'https://creativecommons.org/licenses/by-sa/3.0/';
  if (lower.includes('cc-by-sa-2.5')) return 'https://creativecommons.org/licenses/by-sa/2.5/';
  if (lower.includes('cc-by-sa-2.0')) return 'https://creativecommons.org/licenses/by-sa/2.0/';
  if (lower.includes('cc-by-4.0')) return 'https://creativecommons.org/licenses/by/4.0/';
  if (lower.includes('cc-by-3.0')) return 'https://creativecommons.org/licenses/by/3.0/';
  if (lower.includes('cc-by-2.5')) return 'https://creativecommons.org/licenses/by/2.5/';
  if (lower.includes('cc-by-2.0')) return 'https://creativecommons.org/licenses/by/2.0/';
  return 'https://creativecommons.org/licenses/';
}

export function generateCredits(): ImageCredit[] {
  const sourceDir = path.resolve('tamil_json_by_module_activity');
  const modDirs = fs.readdirSync(sourceDir).filter(d => d.startsWith('Module_'));
  const pathToCredits = new Map<string, ImageCredit>();

  for (const md of modDirs) {
    const files = fs.readdirSync(path.join(sourceDir, md)).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const list = JSON.parse(fs.readFileSync(path.join(sourceDir, md, f), 'utf8'));
      for (const r of list) {
        if (r.image && r.image.path) {
          const p = r.image.path;
          const lic = (r.image.license || '').toLowerCase();
          if (lic.startsWith('cc-by') || lic.startsWith('cc by')) {
            const word = r['Target Word'] || r['Normalized Word'] || r['Correct Answer'] || '';
            const id = r['FTS ID'] || r['Source ID'] || '';
            if (!pathToCredits.has(p)) {
              pathToCredits.set(p, {
                id,
                word,
                path: p,
                creator: (r.image.creator || '').trim(),
                license: r.image.license || '',
                licenseName: formatLicenseName(r.image.license),
                licenseUrl: getLicenseUrl(r.image.license),
                sourcePageUrl: r.image.sourcePageUrl || ''
              });
            } else {
              const existing = pathToCredits.get(p)!;
              if (word && !existing.word.split(', ').includes(word)) {
                existing.word += `, ${word}`;
              }
            }
          }
        }
      }
    }
  }

  const credits = Array.from(pathToCredits.values()).sort((a, b) => a.word.localeCompare(b.word, 'ta'));
  return credits;
}

if (process.argv[1]?.endsWith('generate-credits-data.ts')) {
  const credits = generateCredits();
  console.log(`Generated ${credits.length} CC image credits.`);
  const outPath = path.resolve('src/content/image-credits.json');
  fs.writeFileSync(outPath, JSON.stringify(credits, null, 2), 'utf8');
  console.log(`Wrote credits to ${outPath}`);
}
