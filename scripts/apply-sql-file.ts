/**
 * Applies a SQL file statement by statement on ONE connection (so BEGIN/COMMIT in the file hold),
 * printing each statement's row count. Refuses the production DATABASE_URL.
 *   npx tsx scripts/apply-sql-file.ts <file.sql> <connection-url>
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from '@neondatabase/serverless';
import { splitSqlStatements } from '../server/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const [file, url] = process.argv.slice(2);
  if (!file || !url) throw new Error('Usage: apply-sql-file.ts <file.sql> <connection-url>');
  for (const prod of [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED]) {
    if (prod && new URL(prod).host.replace('-pooler', '') === new URL(url).host.replace('-pooler', '')) {
      throw new Error('Target is the production endpoint. Refusing.');
    }
  }

  const statements = splitSqlStatements(fs.readFileSync(file, 'utf8'));
  console.log(`Target endpoint: ${new URL(url).host}`);
  console.log(`Applying ${path.basename(file)}: ${statements.length} statements`);

  const client = new Client(url);
  await client.connect();
  try {
    for (const [i, statement] of statements.entries()) {
      const firstLine = statement.split('\n')[0].trim().slice(0, 90);
      const res = await client.query(statement);
      const count = res.rowCount === null || res.rowCount === undefined ? '-' : res.rowCount;
      console.log(`${String(i + 1).padStart(3)}. ${res.command ?? ''} rows=${count}  ${firstLine}`);
    }
  } finally {
    await client.end();
  }
  console.log('OK');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
