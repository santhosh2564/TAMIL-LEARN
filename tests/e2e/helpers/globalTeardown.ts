import fs from 'fs';
import { cleanupClass, SeededClass } from './loginStudent';
import { SEED_FILE } from './globalSetup';

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(SEED_FILE)) return;
  const seeded = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as SeededClass;
  await cleanupClass(seeded);
  fs.rmSync(SEED_FILE);
  console.log(`[global-teardown] removed TEST class ${seeded.classCode}`);
}
