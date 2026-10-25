import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface PilotWord {
  word: string;
  creator: string;
  license: string;
  sourceUrl: string;
  matchedCandidate: string;
  sha256: string;
}

const wordsData = JSON.parse(fs.readFileSync('scratch/step1_table.json', 'utf8'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pilot 15 Images - Verified Contact Sheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 32px;
    }
    header {
      border-bottom: 2px solid #334155;
      padding-bottom: 16px;
      margin-bottom: 28px;
    }
    h1 { font-size: 26px; color: #38bdf8; margin-bottom: 6px; }
    p.sub { color: #94a3b8; font-size: 14px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    .card-header {
      background: #0f172a;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
    }
    .word-badge {
      font-weight: 700;
      font-size: 15px;
      color: #f1f5f9;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .hash-badge {
      font-family: monospace;
      font-size: 11px;
      background: #334155;
      color: #38bdf8;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .img-box {
      width: 100%;
      height: 200px;
      background: #090d16;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 8px;
    }
    .img-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .card-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      border-top: 1px solid #334155;
    }
    .meta-row {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      color: #64748b;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .meta-val {
      color: #cbd5e1;
      font-weight: 500;
      word-break: break-word;
    }
    .meta-val a {
      color: #38bdf8;
      text-decoration: none;
    }
    .license-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 11px;
      background: #1e3a8a;
      color: #93c5fd;
      align-self: flex-start;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Verified Pilot 15 Contact Sheet</h1>
    <p class="sub">15 Verified English vocabulary images with byte-for-byte SHA-256 candidate match, creator attribution, and license.</p>
  </header>
  <div class="grid">
    ${wordsData.map((w: any) => `
      <div class="card" id="card-${w.word}">
        <div class="card-header">
          <span class="word-badge">${w.word}</span>
          <span class="hash-badge">${w.pubHash8}</span>
        </div>
        <div class="img-box">
          <img src="../../public/assets/class-3/english/images/eng-${w.word}.jpg" alt="${w.word}">
        </div>
        <div class="card-body">
          <div class="meta-row">
            <span class="meta-label">Creator</span>
            <span class="meta-val">${w.creator || 'None'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">License</span>
            <span class="license-pill">${w.license || 'Unknown'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Source</span>
            <span class="meta-val"><a href="${w.sourceUrl}" target="_blank">View Source</a></span>
          </div>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>
`;

const outPath = path.resolve('docs/contact-sheets/pilot_15_contact_sheet.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Saved contact sheet to ${outPath}`);
