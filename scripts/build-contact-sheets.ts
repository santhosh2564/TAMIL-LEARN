import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import { LocalContentRepository } from '../src/repositories/implementations/LocalContentRepository';
import { AssetResolver } from '../src/engine/assets/AssetResolver';
import { Activity } from '../src/types';

interface ImageUsageInfo {
  fileName: string;
  diskPath: string;
  webPath: string;
  words: string[];
  activities: string[];
  subjects: string[];
}

function getRequestedImageAssetId(act: Activity): string | null {
  if (act.needsImage === false) return null;
  const isEnglish = act.subject === 'English' || act.language?.startsWith('en');

  if (act.image?.source) return act.image.source;

  if (act.needsImage === true) {
    if (isEnglish) {
      const wordKey = act.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || act.id.toLowerCase();
      return `eng-${wordKey}`;
    }
    return `class3-tamil-picture-${act.id.toLowerCase()}`;
  }

  if (!isEnglish && act.category === 'picture-recognition' && act.variant === 'select') {
    return `class3-tamil-picture-${act.id.toLowerCase()}`;
  }

  return null;
}

export async function collectActiveImages(): Promise<ImageUsageInfo[]> {
  const repo = new LocalContentRepository();
  const activities = await repo.getActivities({ subject: 'all' });
  const resolver = new AssetResolver();

  const usageMap = new Map<string, ImageUsageInfo>();

  for (const act of activities) {
    const assetId = getRequestedImageAssetId(act);
    if (!assetId) continue;

    const res = resolver.resolve({ id: assetId, type: 'image' });
    if (res.status === 'resolved' && res.asset?.path) {
      const rawPath = res.asset.path;
      const cleanRel = rawPath.replace(/^\//, '');
      const diskPath = path.resolve('public', cleanRel);
      const normKey = diskPath.toLowerCase().replace(/\\/g, '/');

      const word = (Array.isArray(act.correctAnswer) ? act.correctAnswer[0] : (act.correctAnswer || act.targetWord || '')).trim();
      const subject = act.subject || (act.language?.startsWith('ta') ? 'Tamil' : 'English');

      if (!usageMap.has(normKey)) {
        usageMap.set(normKey, {
          fileName: path.basename(diskPath),
          diskPath,
          webPath: '/' + cleanRel.replace(/\\/g, '/'),
          words: [],
          activities: [],
          subjects: []
        });
      }

      const item = usageMap.get(normKey)!;
      if (word && !item.words.includes(word)) item.words.push(word);
      if (!item.activities.includes(act.id)) item.activities.push(act.id);
      if (!item.subjects.includes(subject)) item.subjects.push(subject);
    }
  }

  // Sort deterministically: English first alphabetically, then Tamil alphabetically
  const list = Array.from(usageMap.values()).sort((a, b) => {
    const subA = a.subjects.includes('English') ? 'A_English' : 'B_Tamil';
    const subB = b.subjects.includes('English') ? 'A_English' : 'B_Tamil';
    if (subA !== subB) return subA.localeCompare(subB);
    return a.fileName.localeCompare(b.fileName);
  });

  return list;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildContactSheets() {
  const images = await collectActiveImages();
  console.log(`Total active images to audit: ${images.length}`);

  const outDir = path.resolve('docs/contact-sheets');
  fs.mkdirSync(outDir, { recursive: true });

  const pageSize = 20;
  const totalSheets = Math.ceil(images.length / pageSize);
  console.log(`Building ${totalSheets} contact sheets (${pageSize} images per sheet)...`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });

  // Summary manifest of all sheets and items
  const sheetManifest: Array<{ sheet: number; htmlFile: string; imageFile: string; items: any[] }> = [];

  for (let s = 0; s < totalSheets; s++) {
    const sheetNum = s + 1;
    const sheetItems = images.slice(s * pageSize, (s + 1) * pageSize);
    const sheetPad = String(sheetNum).padStart(2, '0');
    const htmlFileName = `sheet-${sheetPad}.html`;
    const imageFileName = `sheet-${sheetPad}.png`;
    const htmlFilePath = path.join(outDir, htmlFileName);
    const imageFilePath = path.join(outDir, imageFileName);

    const cardsHtml = sheetItems.map((item, idx) => {
      const globalIdx = s * pageSize + idx + 1;
      const fileUri = 'file:///' + item.diskPath.replace(/\\/g, '/');
      const wordsStr = item.words.join(' / ');
      const actsStr = item.activities.length <= 4 
        ? item.activities.join(', ')
        : `${item.activities.slice(0, 3).join(', ')} +${item.activities.length - 3}`;

      return `
      <div class="card" id="img-${globalIdx}">
        <div class="card-header">
          <span class="index">#${globalIdx}</span>
          <span class="subject ${item.subjects[0]}">${item.subjects.join('/')}</span>
        </div>
        <div class="img-container">
          <img src="${fileUri}" alt="${escapeHtml(wordsStr)}" loading="eager" />
        </div>
        <div class="info">
          <div class="word" title="${escapeHtml(wordsStr)}">${escapeHtml(wordsStr)}</div>
          <div class="filename" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</div>
          <div class="acts" title="${escapeHtml(item.activities.join(', '))}">${escapeHtml(actsStr)}</div>
        </div>
      </div>
      `;
    }).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Contact Sheet ${sheetNum} of ${totalSheets}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 24px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #334155;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 { font-size: 24px; font-weight: 700; color: #38bdf8; }
    .meta { font-size: 14px; color: #94a3b8; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      padding: 6px 10px;
      background: #0f172a;
      font-size: 11px;
      font-weight: 600;
    }
    .index { color: #38bdf8; }
    .subject.English { color: #4ade80; }
    .subject.Tamil { color: #f472b6; }
    .img-container {
      width: 100%;
      height: 190px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 8px;
    }
    .img-container img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .info {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .word {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .filename {
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .acts {
      font-size: 10px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Image Contact Sheet — Page ${sheetNum} of ${totalSheets}</h1>
      <div class="meta">Images ${s * pageSize + 1} – ${Math.min((s + 1) * pageSize, images.length)} of ${images.length}</div>
    </div>
  </header>
  <div class="grid">
    ${cardsHtml}
  </div>
</body>
</html>`;

    fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');

    // Screenshot page with Playwright
    await page.goto('file:///' + htmlFilePath.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.waitForTimeout(300); // ensure images decode
    await page.screenshot({ path: imageFilePath, fullPage: true });

    sheetManifest.push({
      sheet: sheetNum,
      htmlFile: htmlFileName,
      imageFile: imageFileName,
      items: sheetItems.map((it, i) => ({
        index: s * pageSize + i + 1,
        fileName: it.fileName,
        words: it.words,
        webPath: it.webPath,
        diskPath: it.diskPath,
        activities: it.activities,
        subjects: it.subjects
      }))
    });

    console.log(`Rendered sheet ${sheetNum}/${totalSheets} -> ${imageFileName}`);
  }

  await browser.close();

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(sheetManifest, null, 2),
    'utf8'
  );
  console.log(`Successfully built all ${totalSheets} contact sheets in docs/contact-sheets/`);
}

if (process.argv[1]?.endsWith('build-contact-sheets.ts')) {
  buildContactSheets().catch(err => {
    console.error('Error building contact sheets:', err);
    process.exit(1);
  });
}
