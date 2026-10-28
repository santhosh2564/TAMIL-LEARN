import * as fs from 'fs';
import * as path from 'path';
import { extractSourceId } from '../src/engine/assets/sourceIdExtractor';
import { AssetManifest, AssetManifestEntry } from '../src/engine/assets/types';

const SOURCE_IMAGES_DIR = path.resolve('Tamil spelling images');
const PUBLIC_TAMIL_DIR = path.resolve('public/images/tamil-vocabulary');
const ASSET_MANIFEST_FILE = path.resolve('src/content/class-3/tamil/asset-manifest.json');
const CREDITS_FILE = path.resolve('src/content/image-credits.json');
const TAMIL_JSON_MODULE_DIR = path.resolve('tamil_json_by_module_activity');

export interface IngestedImageInfo {
  sourceId: string;
  sourceFile: string;
  canonicalPath: string;
  originalPath: string;
}

export function ingestTamilImages(): {
  totalScanned: number;
  mappedSourceIds: number;
  unmappedFiles: string[];
  manifestEntries: number;
} {
  console.log('=== Ingesting Tamil Spelling Images ===');

  if (!fs.existsSync(SOURCE_IMAGES_DIR)) {
    throw new Error(`Source images directory not found: ${SOURCE_IMAGES_DIR}`);
  }

  // Ensure public directory exists
  if (!fs.existsSync(PUBLIC_TAMIL_DIR)) {
    fs.mkdirSync(PUBLIC_TAMIL_DIR, { recursive: true });
  }

  // 1. Recursive scan excluding accidental nested folder
  function walkDir(dir: string): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const rel = path.relative(SOURCE_IMAGES_DIR, fullPath).replace(/\\/g, '/');
        if (rel.startsWith('Tamil spelling images')) {
          continue; // skip duplicate nested extraction
        }
        results = results.concat(walkDir(fullPath));
      } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allSourceImages = walkDir(SOURCE_IMAGES_DIR);
  console.log(`Found ${allSourceImages.length} image files in source archive folder.`);

  const idToSourceMap = new Map<string, string>();
  const unmappedFiles: string[] = [];

  for (const imgPath of allSourceImages) {
    const fileName = path.basename(imgPath);
    const sid = extractSourceId(fileName);
    if (sid) {
      if (idToSourceMap.has(sid)) {
        console.warn(`Duplicate image for Source ID ${sid}: ${fileName} vs ${path.basename(idToSourceMap.get(sid)!)}`);
      } else {
        idToSourceMap.set(sid, imgPath);
      }
    } else {
      unmappedFiles.push(fileName);
    }
  }

  console.log(`Mapped ${idToSourceMap.size} distinct Source IDs.`);
  console.log(`Unmapped files (${unmappedFiles.length}):`, unmappedFiles);

  // 2. Load existing metadata to preserve provenance & attribution
  const existingManifest: AssetManifest = fs.existsSync(ASSET_MANIFEST_FILE)
    ? JSON.parse(fs.readFileSync(ASSET_MANIFEST_FILE, 'utf8'))
    : {};

  const existingCreditsMap = new Map<string, any>();
  if (fs.existsSync(CREDITS_FILE)) {
    try {
      const credits: any[] = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8'));
      for (const c of credits) {
        if (c.id) existingCreditsMap.set(c.id.toUpperCase(), c);
      }
    } catch (e) {
      console.warn('Could not read existing credits file:', e);
    }
  }

  // 3. Build Module Subfolder reference mapping from tamil_json_by_module_activity
  const legacyModulePaths = new Map<string, string[]>();
  if (fs.existsSync(TAMIL_JSON_MODULE_DIR)) {
    function walkJson(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkJson(full);
        } else if (entry.name.endsWith('.json') && entry.name !== 'index.json') {
          try {
            const data: any[] = JSON.parse(fs.readFileSync(full, 'utf8'));
            for (const item of data) {
              const sid = (item['Source ID'] || item['Question ID'] || item['FTS ID'])?.trim()?.toUpperCase();
              if (sid && item.image?.path) {
                if (!legacyModulePaths.has(sid)) {
                  legacyModulePaths.set(sid, []);
                }
                legacyModulePaths.get(sid)!.push(item.image.path);
              }
            }
          } catch {}
        }
      }
    }
    walkJson(TAMIL_JSON_MODULE_DIR);
  }

  // 4. Copy files to public directories and generate manifest
  const newManifest: AssetManifest = {};

  for (const [sid, sourcePath] of idToSourceMap.entries()) {
    const ext = path.extname(sourcePath).toLowerCase();
    const origFileName = path.basename(sourcePath);
    const canonicalFileName = `${sid}${ext}`;

    // A. Copy original filename to public/images/tamil-vocabulary/
    const destOrig = path.join(PUBLIC_TAMIL_DIR, origFileName);
    fs.copyFileSync(sourcePath, destOrig);

    // B. Copy canonical Source ID filename to public/images/tamil-vocabulary/
    const destCanonical = path.join(PUBLIC_TAMIL_DIR, canonicalFileName);
    fs.copyFileSync(sourcePath, destCanonical);

    // C. Copy to legacy module paths if applicable
    const modulePaths = legacyModulePaths.get(sid) || [];
    for (const modRelPath of modulePaths) {
      const cleanRel = modRelPath.replace(/^\//, '');
      const fullDest = path.resolve('public', cleanRel);
      const destFolder = path.dirname(fullDest);
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
      }
      fs.copyFileSync(sourcePath, fullDest);
    }

    // Determine metadata
    const existingEntry = existingManifest[`class3-tamil-picture-${sid.toLowerCase()}`] ||
                          existingManifest[sid.toLowerCase()] ||
                          existingManifest[sid];
    const credit = existingCreditsMap.get(sid);

    // Prefer original filename from archive for authentic filename preservation
    const publicPath = `/images/tamil-vocabulary/${origFileName}`;

    const manifestEntry: AssetManifestEntry = {
      type: 'image',
      source: 'local',
      path: publicPath,
      alt: credit?.word || existingEntry?.alt || sid,
      creator: credit?.creator || existingEntry?.creator || undefined,
      license: credit?.license || existingEntry?.license || undefined,
      sourcePageUrl: credit?.sourcePageUrl || existingEntry?.sourcePageUrl || undefined,
      provenance: existingEntry?.provenance || {
        source: 'licensed-pack',
        license: credit?.license || null,
        creator: credit?.creator || null,
        sourceUrl: credit?.sourcePageUrl || null
      }
    };

    // Register both lowercase and uppercase keys for resilience
    newManifest[`class3-tamil-picture-${sid.toLowerCase()}`] = manifestEntry;
    newManifest[`class3-tamil-picture-${sid.toUpperCase()}`] = manifestEntry;
    newManifest[sid.toLowerCase()] = manifestEntry;
    newManifest[sid.toUpperCase()] = manifestEntry;
  }

  // Also preserve non-Tamil or other existing assets in manifest if present
  for (const [k, v] of Object.entries(existingManifest)) {
    if (!k.startsWith('class3-tamil-picture-') && !idToSourceMap.has(k.toUpperCase())) {
      newManifest[k] = v;
    }
  }

  // Write new asset manifest
  fs.writeFileSync(ASSET_MANIFEST_FILE, JSON.stringify(newManifest, null, 2), 'utf8');
  console.log(`Updated asset manifest at ${ASSET_MANIFEST_FILE} with ${Object.keys(newManifest).length} total keys.`);

  return {
    totalScanned: allSourceImages.length,
    mappedSourceIds: idToSourceMap.size,
    unmappedFiles,
    manifestEntries: Object.keys(newManifest).length
  };
}

// Execute if run from CLI
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/ingest-tamil-images.ts');
if (isDirectRun) {
  const result = ingestTamilImages();
  console.log('Result:', result);
}
