import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve('Tamil spelling images');

interface ImageEntry {
  filename: string;
  folder: string;
  sizeBytes: number;
  fullPath: string;
}

const sets: Record<string, ImageEntry[]> = {};

for (const folder of fs.readdirSync(ROOT)) {
  const folderPath = path.join(ROOT, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  sets[folder] = [];
  for (const f of fs.readdirSync(folderPath)) {
    const fullPath = path.join(folderPath, f);
    if (fs.statSync(fullPath).isFile()) {
      sets[folder].push({
        filename: f,
        folder,
        sizeBytes: fs.statSync(fullPath).size,
        fullPath
      });
    }
  }
}

for (const [folder, files] of Object.entries(sets)) {
  console.log(`\n=== ${folder} (${files.length} files) ===`);
  for (const file of files) {
    console.log(`  ${file.filename} [${file.sizeBytes} bytes]`);
  }
}
