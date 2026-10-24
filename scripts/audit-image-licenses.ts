import fs from 'fs';
import path from 'path';
import exifr from 'exifr';

function getFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.match(/\.(jpg|jpeg|png|webp|svg)$/i)) {
      results.push(path.normalize(full).replace(/\\/g, '/'));
    }
  }
  return results;
}

async function run() {
  const allFiles = [...getFiles('public/assets'), ...getFiles('public/images')];

  // 1. Build map of all word usages
  const fileToWords = new Map<string, Set<string>>();

  // English activities
  for (let m = 1; m <= 8; m++) {
    const p = `src/content/class-3/english/module-${m}/activities.json`;
    if (fs.existsSync(p)) {
      const list = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const a of list) {
        if (a.image && a.image.source) {
          const file = path.normalize(`public/assets/class-3/english/images/${a.image.source}.jpg`).replace(/\\/g, '/').toLowerCase();
          if (!fileToWords.has(file)) fileToWords.set(file, new Set());
          if (a.targetWord) fileToWords.get(file)!.add(a.targetWord);
        }
      }
    }
  }

  // English asset manifest
  const engAssetManifest = JSON.parse(fs.readFileSync('src/content/class-3/english/asset-manifest.json', 'utf8'));
  for (const [key, val] of Object.entries<any>(engAssetManifest)) {
    if (val.path) {
      const full = path.normalize(`public${val.path}`).replace(/\\/g, '/').toLowerCase();
      if (!fileToWords.has(full)) fileToWords.set(full, new Set());
      const word = key.replace(/^eng-/, '');
      fileToWords.get(full)!.add(word);
    }
  }

  // Tamil raw json by module
  const tamilMetadataMap = new Map<string, any>();
  const ftsToWord = new Map<string, string>();
  const modDirs = fs.readdirSync('tamil_json_by_module_activity').filter(d => d.startsWith('Module_'));
  for (const md of modDirs) {
    const files = fs.readdirSync(path.join('tamil_json_by_module_activity', md)).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const list = JSON.parse(fs.readFileSync(path.join('tamil_json_by_module_activity', md, f), 'utf8'));
      for (const r of list) {
        const id = r['FTS ID'] || r['Source ID'];
        const w = r['Target Word'] || r['Normalized Word'] || r['Correct Answer'];
        if (id && w) ftsToWord.set(id.toUpperCase(), w);
        if (r.image && r.image.path) {
          const file = path.normalize(`public${r.image.path}`).replace(/\\/g, '/').toLowerCase();
          if (!fileToWords.has(file)) fileToWords.set(file, new Set());
          if (w) fileToWords.get(file)!.add(w);
          if (!tamilMetadataMap.has(file)) {
            tamilMetadataMap.set(file, r.image);
          }
        }
      }
    }
  }

  // Tamil asset manifest
  const tamAssetManifest = JSON.parse(fs.readFileSync('src/content/class-3/tamil/asset-manifest.json', 'utf8'));
  for (const [, val] of Object.entries<any>(tamAssetManifest)) {
    if (val.path) {
      const full = path.normalize(`public${val.path}`).replace(/\\/g, '/').toLowerCase();
      if (!fileToWords.has(full)) fileToWords.set(full, new Set());
      if (val.alt) fileToWords.get(full)!.add(val.alt);
    }
  }

  // FTS spelling images
  const ftsManifest = JSON.parse(fs.readFileSync('src/content/class-3/tamil/fts-manifest.json', 'utf8'));
  const ftsList = Array.isArray(ftsManifest) ? ftsManifest : Object.values(ftsManifest);
  for (const item of ftsList) {
    if (item.publicPath) {
      const full = path.normalize(`public${item.publicPath}`).replace(/\\/g, '/').toLowerCase();
      if (item.ftsId && ftsToWord.has(item.ftsId.toUpperCase())) {
        if (!fileToWords.has(full)) fileToWords.set(full, new Set());
        fileToWords.get(full)!.add(ftsToWord.get(item.ftsId.toUpperCase())!);
      }
    }
  }

  // Extract word from filename if still unmapped
  for (const f of allFiles) {
    const norm = f.toLowerCase();
    if (!fileToWords.has(norm) || fileToWords.get(norm)!.size === 0) {
      const mEng = norm.match(/eng-([^/]+)\.jpg$/);
      if (mEng) {
        if (!fileToWords.has(norm)) fileToWords.set(norm, new Set());
        fileToWords.get(norm)!.add(mEng[1].replace(/-/g, ' '));
      }
      const mTam = norm.match(/q\d+_([a-z]+)\.jpg$/);
      if (mTam) {
        if (!fileToWords.has(norm)) fileToWords.set(norm, new Set());
        fileToWords.get(norm)!.add(mTam[1]);
      }
    }
  }

  const csvRows: string[] = ['file,words,watermark,copyright,source'];
  let flaggedCount = 0;
  const flaggedFiles: string[] = [];

  for (const f of allFiles) {
    const norm = f.toLowerCase();
    const wordsSet = fileToWords.get(norm);
    const words = wordsSet && wordsSet.size > 0 ? Array.from(wordsSet).join('; ') : 'Unmapped';

    let copyright = '';
    let source = '';
    let watermark = 'no';

    // Tamil metadata from source JSONs
    const tMeta = tamilMetadataMap.get(norm);
    if (tMeta) {
      if (tMeta.creator) copyright = tMeta.creator + (tMeta.license ? ` (${tMeta.license})` : '');
      if (tMeta.sourcePageUrl) source = tMeta.sourcePageUrl;
      else if (tMeta.imageSource) source = tMeta.imageSource;
    }

    // EXIF / IPTC / XMP tags
    try {
      const buf = fs.readFileSync(f);
      const data = await exifr.parse(buf, { tiff: true, xmp: true, iptc: true });
      if (data) {
        const cVal = data.Copyright || data.copyright || data.Rights || data.CopyrightNotice;
        const aVal = data.Artist || data.artist || data.Creator || data.Byline;
        const cStr = typeof cVal === 'object' && cVal ? (cVal.value || JSON.stringify(cVal)) : cVal;
        const aStr = typeof aVal === 'object' && aVal ? (aVal.value || JSON.stringify(aVal)) : aVal;
        
        if (cStr) {
          copyright = copyright ? `${copyright}; EXIF: ${cStr}` : `EXIF: ${cStr}`;
        } else if (aStr) {
          copyright = copyright ? `${copyright}; Creator: ${aStr}` : `Creator: ${aStr}`;
        }

        if (data.Credit && !source) {
          source = `Credit: ${data.Credit}`;
        }
        if (data.Source && !source) {
          source = `Source: ${data.Source}`;
        }
      }
    } catch (e) {}

    // Check for stock agency strings
    const buf = fs.readFileSync(f);
    const text = buf.toString('latin1').toLowerCase();
    const agencies = ['alamy', 'shutterstock', 'getty', 'istock', 'dreamstime', '123rf', 'adobe stock', 'adobestock'];
    for (const ag of agencies) {
      if (text.includes(ag)) {
        watermark = `yes (${ag})`;
        flaggedCount++;
        flaggedFiles.push(f);
        break;
      }
    }

    if (!copyright) copyright = 'None';
    if (!source) source = f.startsWith('public/assets/class-3/english') ? 'unknown' : 'None';

    function escapeCsv(val: any): string {
      const str = String(val).replace(/\r?\n/g, ' ').replace(/"/g, '""');
      return `"${str}"`;
    }

    csvRows.push([
      escapeCsv(f),
      escapeCsv(words),
      escapeCsv(watermark),
      escapeCsv(copyright),
      escapeCsv(source)
    ].join(','));
  }

  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/image-license-audit.csv', csvRows.join('\n'), 'utf8');
  console.log(`Successfully wrote docs/image-license-audit.csv with ${csvRows.length - 1} records.`);
  console.log(`Flagged files with stock watermarks: ${flaggedCount}`);
  if (flaggedFiles.length > 0) {
    console.log('Flagged files:', flaggedFiles);
  }
}

run().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
